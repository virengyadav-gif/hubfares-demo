/** Quote → revalidate → PNR (hold) → ticket (charge) lifecycle (WF-09, Technical Design §4.4). */
import { and, eq, inArray, desc, like, or, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { nextId, nextSeq, audit, domainEvent, notify, Tx } from '@/server/db/util';
import { withIdempotency } from '@/server/idempotency';
import { gdsAdapter } from '@/server/providers/gds/sabre-mock';
import type { SessionCtx } from '@/server/auth/session';
import { assertOwned, requireActiveAgency, isHub, agencyScope } from '@/server/auth/authorize';
import { AppError, NEUTRAL_NOT_FOUND } from '@/shared/errors';
import { nowIso, isoPlus, nowMs, DAY } from '@/shared/time';
import { priceBrandsForOffers } from '@/features/search/service';
import { fundingPosition, allocateFunding } from '@/features/wallet-credit/position';
import { effectivePolicy, refundCfg, creditCfg } from '@/features/wallet-credit/policies';
import { getMeta } from '@/server/db/util';

export const QUOTE_TTL_MS = 30 * 60 * 1000;
export const quoteSchema = z.object({
  tripType: z.enum(['ONE_WAY', 'ROUND_TRIP']),
  legs: z.array(z.object({ offerId: z.string(), brandId: z.string() })).min(1).max(2),
  adults: z.number().int().min(1).max(4).default(1), children: z.number().int().min(0).max(0).default(0), infants: z.number().int().min(0).max(0).default(0),
});
const sameAirport = (a: string, b: string) => a === b;

export function createQuote(db: DB, ctx: SessionCtx, input: z.infer<typeof quoteSchema>) {
  requireActiveAgency(ctx);
  const agencyId = ctx.agencyId!;
  if (input.tripType === 'ONE_WAY' && input.legs.length !== 1) throw new AppError('VALIDATION_ERROR', 'A one-way quote has exactly one leg');
  if (input.tripType === 'ROUND_TRIP' && input.legs.length !== 2) throw new AppError('VALIDATION_ERROR', 'A return quote needs both an outbound and an inbound flight selected');
  const priced = priceBrandsForOffers(db, agencyId, input.legs.map((l) => l.offerId));
  const legs = input.legs.map((l, i) => {
    const offer = priced.find((o) => o.id === l.offerId);
    const brand = offer?.brands.find((b) => b.id === l.brandId);
    if (!offer || !brand) throw new AppError('VALIDATION_ERROR', `Leg ${i + 1}: unknown offer or fare brand`);
    if (Date.parse(offer.departureAt) <= nowMs()) throw new AppError('VALIDATION_ERROR', `Leg ${i + 1}: this flight has already departed`);
    if (offer.seatsLeft <= 0) throw new AppError('VALIDATION_ERROR', `Leg ${i + 1}: sold out in demo inventory`);
    return { offer, brand };
  });
  if (input.tripType === 'ROUND_TRIP') {
    const [o, r] = legs;
    if (!sameAirport(r.offer.origin, o.offer.destination) || !sameAirport(r.offer.destination, o.offer.origin)) throw new AppError('VALIDATION_ERROR', 'Inbound flight must return from the outbound destination to the origin');
    if (Date.parse(r.offer.departureAt) <= Date.parse(o.offer.arrivalAt)) throw new AppError('VALIDATION_ERROR', 'Inbound flight must depart after the outbound flight arrives');
  }
  const pax = input.adults;
  const created = nowIso();
  return db.transaction((tx) => {
    const id = nextId(tx, 'quote');
    const segs = legs.map(({ offer, brand }, i) => ({
      id: `${id}_l${i}`, quoteId: id, legIndex: i, direction: i === 0 ? 'OUTBOUND' : 'INBOUND', offerId: offer.id, brandId: brand.id,
      fareRuleProfileId: brand.ruleProfileId, profileVersion: 1, coreRuleId: brand.coreRuleId, coreRuleVersion: brand.coreRuleVersion,
      supplierBaseMinor: brand.components.supplierBaseMinor, supplierTaxMinor: brand.components.supplierTaxMinor, fixedFeeMinor: brand.components.fixedFeeMinor,
      percentFeeMinor: brand.components.percentFeeMinor, disclosedServiceFeeMinor: brand.components.disclosedServiceFeeMinor, rebateMinor: brand.components.rebateMinor,
      priceAdjustmentMinor: 0, legSellMinor: brand.sellMinor, legSupplierCostMinor: brand.components.legSupplierCostMinor,
      departureAt: offer.departureAt, arrivalAt: offer.arrivalAt,
      snapshotJson: JSON.stringify({ offer: { id: offer.id, airlineCode: offer.airlineCode, airlineName: offer.airlineName, flightNumber: offer.flightNumber, origin: offer.origin, destination: offer.destination, originTz: offer.originTz, destinationTz: offer.destinationTz, cabin: offer.cabin, stops: offer.stops, via: offer.via, durationMin: offer.durationMin }, brand: { id: brand.id, brandCode: brand.brandCode, brandName: brand.brandName, fareClass: brand.fareClass, refundableLabel: brand.refundableLabel, baggage: brand.baggage, meal: brand.meal }, rationale: brand.rationale }),
    }));
    const sell = segs.reduce((a, x) => a + x.legSellMinor, 0) * pax;
    const cost = segs.reduce((a, x) => a + x.legSupplierCostMinor, 0) * pax;
    tx.insert(s.quotes).values({ id, agencyId, userId: ctx.userId, tripType: input.tripType, segmentCount: segs.length, supplierCostMinor: cost, sellAmountMinor: sell, currency: 'INR', passengersJson: JSON.stringify({ adults: pax, children: 0, infants: 0 }), status: 'OPEN', createdAt: created, expiresAt: isoPlus(created, QUOTE_TTL_MS), snapshotJson: JSON.stringify({ pricedPerAdult: true, markupApplied: false }) }).run();
    for (const sg of segs) tx.insert(s.quoteSegments).values(sg).run();
    return getQuote(tx, ctx, id);
  });
}
export function getQuote(db: Tx, ctx: SessionCtx, id: string) {
  const q = db.select().from(s.quotes).where(eq(s.quotes.id, id)).get();
  if (!q) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
  assertOwned(ctx, q.agencyId);
  const segs = db.select().from(s.quoteSegments).where(eq(s.quoteSegments.quoteId, id)).orderBy(s.quoteSegments.legIndex).all();
  const pax = JSON.parse(q.passengersJson);
  return {
    quoteId: q.id, agencyId: q.agencyId, tripType: q.tripType, status: q.status, previousQuoteId: q.previousQuoteId, createdAt: q.createdAt, expiresAt: q.expiresAt, passengers: pax,
    sellAmount: { amountMinor: q.sellAmountMinor, currency: 'INR' }, supplierCost: { amountMinor: q.supplierCostMinor, currency: 'INR' }, source: 'SEEDED',
    segments: segs.map((g) => {
      const snap = JSON.parse(g.snapshotJson);
      return { legIndex: g.legIndex, direction: g.direction, offerId: g.offerId, brandId: g.brandId, ...snap.offer, brand: snap.brand, departureAt: g.departureAt, arrivalAt: g.arrivalAt,
        fareRuleProfileId: g.fareRuleProfileId, fareRuleProfileVersion: g.profileVersion, coreCommercialRuleId: g.coreRuleId, coreCommercialRuleVersion: g.coreRuleVersion, rationale: snap.rationale,
        legSellAmount: { amountMinor: g.legSellMinor, currency: 'INR' }, legSupplierCost: { amountMinor: g.legSupplierCostMinor, currency: 'INR' },
        priceComponents: [{ key: 'supplierBase', amountMinor: g.supplierBaseMinor }, { key: 'supplierTax', amountMinor: g.supplierTaxMinor }, ...(g.priceAdjustmentMinor ? [{ key: 'revalidationPriceChange', amountMinor: g.priceAdjustmentMinor }] : []), { key: 'hubfaresFixedFee', amountMinor: g.fixedFeeMinor }, { key: 'hubfaresPercentFee', amountMinor: g.percentFeeMinor }, { key: 'disclosedServiceFee', amountMinor: g.disclosedServiceFeeMinor }] };
    }),
  };
}
function loadOwnedQuote(tx: Tx, ctx: SessionCtx, id: string) {
  const q = tx.select().from(s.quotes).where(eq(s.quotes.id, id)).get();
  if (!q) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
  assertOwned(ctx, q.agencyId);
  return q;
}
export function revalidateQuote(db: DB, ctx: SessionCtx, id: string, scenario: 'reval_same' | 'reval_change' | 'reval_unavailable' = 'reval_same') {
  return db.transaction((tx) => {
    const q = loadOwnedQuote(tx, ctx, id);
    if (q.status !== 'OPEN') throw new AppError('INVALID_STATE', `Quote is ${q.status}; start from a fresh quote`);
    if (Date.parse(q.expiresAt) < nowMs()) { tx.update(s.quotes).set({ status: 'EXPIRED' }).where(eq(s.quotes.id, id)).run(); throw new AppError('QUOTE_EXPIRED', 'This quote has expired — please search and re-quote'); }
    const r = gdsAdapter('SABRE').revalidateFare(scenario);
    if (r.status === 'UNAVAILABLE') {
      tx.update(s.quotes).set({ status: 'UNAVAILABLE' }).where(eq(s.quotes.id, id)).run();
      return { status: 'UNAVAILABLE' as const, quote: getQuote(tx, ctx, id), scenario, message: 'Simulated Sabre revalidation: fare no longer available. No booking or charge was made.' };
    }
    if (r.status === 'SAME') {
      tx.update(s.quotes).set({ status: 'REVALIDATED' }).where(eq(s.quotes.id, id)).run();
      return { status: 'SAME' as const, quote: getQuote(tx, ctx, id), scenario };
    }
    // CHANGED: supersede and issue a revised quote that requires explicit acceptance of the full new itinerary total
    const pax = JSON.parse(q.passengersJson).adults as number;
    const segs = tx.select().from(s.quoteSegments).where(eq(s.quoteSegments.quoteId, id)).orderBy(s.quoteSegments.legIndex).all();
    const nid = nextId(tx, 'quote');
    const created = nowIso();
    const newSegs = segs.map((g, i) => i === 0 ? { ...g, id: `${nid}_l${i}`, quoteId: nid, priceAdjustmentMinor: r.priceDeltaMinor, legSellMinor: g.legSellMinor + r.priceDeltaMinor, legSupplierCostMinor: g.legSupplierCostMinor + r.priceDeltaMinor } : { ...g, id: `${nid}_l${i}`, quoteId: nid });
    tx.update(s.quotes).set({ status: 'SUPERSEDED' }).where(eq(s.quotes.id, id)).run();
    tx.insert(s.quotes).values({ ...q, id: nid, status: 'PRICE_CHANGED', previousQuoteId: id, createdAt: created, expiresAt: isoPlus(created, QUOTE_TTL_MS), sellAmountMinor: newSegs.reduce((a, x) => a + x.legSellMinor, 0) * pax, supplierCostMinor: newSegs.reduce((a, x) => a + x.legSupplierCostMinor, 0) * pax }).run();
    for (const g of newSegs) tx.insert(s.quoteSegments).values(g).run();
    return { status: 'CHANGED' as const, previousQuote: getQuote(tx, ctx, id), quote: getQuote(tx, ctx, nid), scenario, message: 'Simulated Sabre revalidation returned a new price. Accept the revised itinerary total to continue.' };
  });
}
export function decideRevisedQuote(db: DB, ctx: SessionCtx, id: string, accept: boolean) {
  return db.transaction((tx) => {
    const q = loadOwnedQuote(tx, ctx, id);
    if (q.status !== 'PRICE_CHANGED') throw new AppError('INVALID_STATE', 'Only a price-changed quote can be accepted or declined');
    tx.update(s.quotes).set({ status: accept ? 'REVALIDATED' : 'DECLINED' }).where(eq(s.quotes.id, id)).run();
    return getQuote(tx, ctx, id);
  });
}

export const bookingSchema = z.object({
  quoteId: z.string(),
  passengers: z.array(z.object({ title: z.enum(['Mr', 'Ms', 'Mx']), firstName: z.string().trim().min(1).max(40).regex(/^[A-Za-z .'-]+$/), lastName: z.string().trim().min(1).max(40).regex(/^[A-Za-z .'-]+$/) })).min(1).max(4),
  contactEmail: z.string().email().max(120),
  scenario: z.enum(['normal', 'booking_fail']).default('normal'),
});
export function createBooking(db: DB, ctx: SessionCtx, input: z.infer<typeof bookingSchema>, idemKey: string) {
  requireActiveAgency(ctx);
  const agencyId = ctx.agencyId!;
  return db.transaction((tx) => withIdempotency(tx, 'booking.create', idemKey, { userId: ctx.userId, agencyId }, input, () => {
    const q = loadOwnedQuote(tx, ctx, input.quoteId);
    if (q.status !== 'REVALIDATED') throw new AppError('INVALID_STATE', q.status === 'PRICE_CHANGED' ? 'Accept the revised price before booking' : 'Revalidate the quote before booking');
    if (Date.parse(q.expiresAt) < nowMs()) throw new AppError('QUOTE_EXPIRED', 'This quote has expired — please re-quote');
    const pax = JSON.parse(q.passengersJson).adults as number;
    if (input.passengers.length !== pax) throw new AppError('VALIDATION_ERROR', `Enter details for exactly ${pax} adult traveller(s)`);
    const pos = fundingPosition(tx, agencyId, nowIso());
    const alloc = allocateFunding(pos, q.sellAmountMinor);
    if (!alloc) {
      const msg = pos.creditBlocked ? `Insufficient spending power: wallet available ₹${(pos.availableWalletMinor / 100).toFixed(2)}; credit blocked — ${pos.blockReason}` : `Insufficient spending power: need ₹${(q.sellAmountMinor / 100).toFixed(2)}, available ₹${(pos.spendingPowerMinor / 100).toFixed(2)}`;
      throw new AppError('INSUFFICIENT_FUNDS', msg, { requiredMinor: q.sellAmountMinor, availableWalletMinor: pos.availableWalletMinor, availableCreditMinor: pos.availableCreditMinor, creditBlocked: pos.creditBlocked });
    }
    const bookedAt = nowIso();
    const refundPol = effectivePolicy(tx, agencyId, 'REFUND', bookedAt);
    if (!refundPol) throw new AppError('INVALID_STATE', 'No effective refund policy for this agency');
    const rc = refundCfg(refundPol);
    const segs = tx.select().from(s.quoteSegments).where(eq(s.quoteSegments.quoteId, q.id)).orderBy(s.quoteSegments.legIndex).all();
    const profiles = Object.fromEntries(tx.select().from(s.fareRuleProfiles).all().map((p) => [p.id, p.dataJson]));
    const id = nextId(tx, 'book_demo');
    const resId = `res_${id}`;
    const snaps = segs.map((g) => JSON.parse(g.snapshotJson));
    const lead = `${input.passengers[0].title} ${input.passengers[0].firstName} ${input.passengers[0].lastName}`;
    const route = segs.length === 2 ? `${snaps[0].offer.origin}-${snaps[0].offer.destination}-${snaps[1].offer.destination}` : `${snaps[0].offer.origin}-${snaps[0].offer.destination}`;
    tx.insert(s.bookings).values({
      id, agencyId, quoteId: q.id, userId: ctx.userId, source: 'PORTAL', provider: 'SABRE', pcc: 'HFDEMO1', tripType: q.tripType, segmentCount: segs.length,
      bookingStatus: 'PNR_CREATED', ticketStatus: 'PENDING', paymentStatus: 'HELD', fundingType: alloc.creditHold && alloc.walletHold ? 'MIXED' : alloc.creditHold ? 'CREDIT' : 'WALLET',
      bookedAt, firstDepartureAt: segs[0].departureAt, routeSummary: route, airlineSummary: [...new Set(snaps.map((x) => x.offer.airlineCode))].join('/'), leadPassenger: lead,
      sellAmountMinor: q.sellAmountMinor, supplierCostMinor: q.supplierCostMinor, currency: 'INR',
      refundPolicyId: refundPol.id, refundPolicyVersion: refundPol.version, refundPayoutMode: rc.payoutMode,
      bookingSnapshotJson: JSON.stringify({ quoteId: q.id, passengers: { adults: pax, children: 0, infants: 0 }, contactEmail: input.contactEmail, funding: alloc, refundPolicy: { id: refundPol.id, version: refundPol.version, payoutMode: rc.payoutMode, autoApproveLimitMinor: rc.autoApproveLimitMinor }, creditPolicyAtBooking: { id: pos.creditPolicyId, version: pos.creditPolicyVersion }, markupApplied: false }),
      updatedAt: bookedAt,
    }).run();
    segs.forEach((g, i) => {
      const sn = snaps[i];
      tx.insert(s.bookingSegments).values({ id: `${id}_seg${i}`, bookingId: id, legIndex: g.legIndex, direction: g.direction, flightOfferId: g.offerId, airline: sn.offer.airlineCode, airlineName: sn.offer.airlineName, flightNumber: sn.offer.flightNumber, origin: sn.offer.origin, destination: sn.offer.destination, departureAt: g.departureAt, arrivalAt: g.arrivalAt, originTz: sn.offer.originTz, destinationTz: sn.offer.destinationTz, cabin: sn.offer.cabin, fareBrandId: g.brandId, brandName: sn.brand.brandName, fareRuleProfileId: g.fareRuleProfileId, profileVersion: g.profileVersion, fareRuleSnapshotJson: profiles[g.fareRuleProfileId], segmentSellMinor: g.legSellMinor * pax, segmentSupplierCostMinor: g.legSupplierCostMinor * pax, priceComponentsJson: JSON.stringify({ perAdult: true, adults: pax, supplierBaseMinor: g.supplierBaseMinor, supplierTaxMinor: g.supplierTaxMinor, priceAdjustmentMinor: g.priceAdjustmentMinor, fixedFeeMinor: g.fixedFeeMinor, percentFeeMinor: g.percentFeeMinor, disclosedServiceFeeMinor: g.disclosedServiceFeeMinor, rebateMinor: g.rebateMinor * pax, coreRuleId: g.coreRuleId, coreRuleVersion: g.coreRuleVersion }) }).run();
    });
    input.passengers.forEach((p, i) => tx.insert(s.passengers).values({ id: `${id}_pax${i + 1}`, bookingId: id, displayName: `${p.title} ${p.firstName} ${p.lastName}`, travelerType: 'ADULT', maskedDocReference: null }).run());
    tx.insert(s.fundingReservations).values({ id: resId, agencyId, bookingId: id, walletHoldMinor: alloc.walletHold, creditHoldMinor: alloc.creditHold, status: 'ACTIVE', createdAt: bookedAt, expiresAt: isoPlus(bookedAt, DAY), updatedAt: bookedAt }).run();
    tx.update(s.quotes).set({ status: 'BOOKED' }).where(eq(s.quotes.id, q.id)).run();
    const gds = gdsAdapter('SABRE').createBooking(input.scenario, nextSeq(tx, 'pnr'));
    if (!gds.ok) {
      tx.update(s.bookings).set({ bookingStatus: 'BOOKING_FAILED', ticketStatus: 'NOT_ISSUED', paymentStatus: 'RELEASED', failureReason: gds.message, updatedAt: nowIso() }).where(eq(s.bookings.id, id)).run();
      tx.update(s.fundingReservations).set({ status: 'RELEASED', updatedAt: nowIso() }).where(eq(s.fundingReservations.id, resId)).run();
      audit(tx, { userId: ctx.userId, role: ctx.role }, 'BOOKING_FAILED', 'booking', id, agencyId, { code: gds.code });
      domainEvent(tx, 'booking.failed', 'booking', id, agencyId, { reason: gds.code });
      return { bookingId: id, bookingStatus: 'BOOKING_FAILED', error: { code: gds.code, message: gds.message } };
    }
    tx.insert(s.pnrRecords).values({ id: `${id}_pnr`, bookingId: id, provider: 'SABRE', pcc: 'HFDEMO1', gdsPnr: gds.pnr, airlinePnr: null, imported: false, createdAt: bookedAt }).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'BOOKING_PNR_CREATED', 'booking', id, agencyId, { pnr: gds.pnr, holdWalletMinor: alloc.walletHold, holdCreditMinor: alloc.creditHold, refundPolicy: `${refundPol.id} v${refundPol.version}` });
    domainEvent(tx, 'booking.pnr_created', 'booking', id, agencyId, { pnr: gds.pnr });
    return { bookingId: id, bookingStatus: 'PNR_CREATED', gdsPnr: gds.pnr };
  }));
}

export const ticketSchema = z.object({ scenario: z.enum(['normal', 'ticket_fail']).default('normal') });
export function issueTicket(db: DB, ctx: SessionCtx, bookingId: string, input: z.infer<typeof ticketSchema>, idemKey: string) {
  return db.transaction((tx) => withIdempotency(tx, 'booking.issue_ticket', `${bookingId}:${idemKey}`, { userId: ctx.userId, agencyId: ctx.agencyId }, { bookingId, ...input }, () => {
    const b = tx.select().from(s.bookings).where(eq(s.bookings.id, bookingId)).get();
    if (!b) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
    assertOwned(ctx, b.agencyId);
    if (b.bookingStatus !== 'PNR_CREATED') throw new AppError('INVALID_STATE', b.bookingStatus === 'TICKETED' ? 'Ticket already issued for this booking' : `Cannot issue a ticket from status ${b.bookingStatus}`);
    const res = tx.select().from(s.fundingReservations).where(and(eq(s.fundingReservations.bookingId, bookingId), eq(s.fundingReservations.status, 'ACTIVE'))).get();
    if (!res) throw new AppError('INVALID_STATE', 'No active funding reservation for this booking');
    const paxRows = tx.select().from(s.passengers).where(eq(s.passengers.bookingId, bookingId)).all();
    const seqStart = 900000 + nextSeq(tx, 'ticket') * 10;
    const r = gdsAdapter('SABRE').issueTicket(input.scenario, seqStart, paxRows.length);
    const at = nowIso();
    if (!r.ok) {
      tx.update(s.bookings).set({ bookingStatus: 'TICKETING_FAILED', ticketStatus: 'FAILED', paymentStatus: 'RELEASED', failureReason: r.message, updatedAt: at }).where(eq(s.bookings.id, bookingId)).run();
      tx.update(s.fundingReservations).set({ status: 'RELEASED', updatedAt: at }).where(eq(s.fundingReservations.id, res.id)).run();
      audit(tx, { userId: ctx.userId, role: ctx.role }, 'TICKETING_FAILED', 'booking', bookingId, b.agencyId, { code: r.code });
      domainEvent(tx, 'booking.ticketing_failed', 'booking', bookingId, b.agencyId);
      notify(tx, { audience: 'HUB', agencyId: b.agencyId, kind: 'TICKETING_FAILED', referenceId: bookingId, title: `Ticketing failed for ${bookingId} (simulated) — hold released` });
      return { bookingId, bookingStatus: 'TICKETING_FAILED', error: { code: r.code, message: r.message } };
    }
    r.ticketNumbers.forEach((t, i) => tx.insert(s.tickets).values({ id: `${bookingId}_tkt${i + 1}`, bookingId, passengerId: paxRows[i]?.id ?? null, ticketNumber: t, issuedAt: at, status: 'ISSUED', imported: false }).run());
    if (res.walletHoldMinor > 0) tx.insert(s.walletLedgerEntries).values({ id: nextId(tx, 'wle'), agencyId: b.agencyId, type: 'BOOKING_DEBIT', direction: 'DEBIT', amountMinor: res.walletHoldMinor, currency: 'INR', bookingId, description: `Ticket ${r.ticketNumbers[0]} · ${b.routeSummary}`, idempotencyKey: `book:${bookingId}:ticket`, createdAt: at }).run();
    if (res.creditHoldMinor > 0) {
      const cp = creditCfg(effectivePolicy(tx, b.agencyId, 'CREDIT', at));
      tx.insert(s.creditLedgerEntries).values({ id: nextId(tx, 'cle'), agencyId: b.agencyId, type: 'DRAW', direction: 'DRAW', amountMinor: res.creditHoldMinor, bookingId, dueAt: isoPlus(at, cp.termDays * DAY), description: `Credit draw · ticket ${r.ticketNumbers[0]}`, idempotencyKey: `book:${bookingId}:ticket`, createdAt: at }).run();
    }
    tx.update(s.fundingReservations).set({ status: 'CONSUMED', updatedAt: at }).where(eq(s.fundingReservations.id, res.id)).run();
    tx.update(s.bookings).set({ bookingStatus: 'TICKETED', ticketStatus: 'ISSUED', paymentStatus: 'CHARGED', updatedAt: at }).where(eq(s.bookings.id, bookingId)).run();
    const cost = Number(getMeta(tx, 'costModelPerTicketMinor') ?? 3500);
    tx.insert(s.modeledCosts).values({ id: `${bookingId}_cost`, bookingId, agencyId: b.agencyId, kind: 'VARIABLE_PROCESSING', amountMinor: cost, createdAt: at }).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'TICKET_ISSUED', 'booking', bookingId, b.agencyId, { tickets: r.ticketNumbers, walletDebitMinor: res.walletHoldMinor, creditDrawMinor: res.creditHoldMinor });
    domainEvent(tx, 'booking.ticketed', 'booking', bookingId, b.agencyId, { amountMinor: b.sellAmountMinor });
    notify(tx, { audience: 'AGENCY', agencyId: b.agencyId, kind: 'TICKETED', referenceId: bookingId, title: `Ticket issued (simulated) for ${b.routeSummary} · ${r.ticketNumbers.join(', ')}` });
    return { bookingId, bookingStatus: 'TICKETED', ticketNumbers: r.ticketNumbers, walletDebitMinor: res.walletHoldMinor, creditDrawMinor: res.creditHoldMinor };
  }));
}

export const listSchema = z.object({ q: z.string().optional(), status: z.string().optional(), agencyId: z.string().optional(), from: z.string().optional(), to: z.string().optional(), route: z.string().optional(), airline: z.string().optional(), source: z.string().optional(), provider: z.string().optional(), limit: z.coerce.number().int().min(1).max(500).default(200) });
export function listBookings(db: Tx, ctx: SessionCtx, f: z.infer<typeof listSchema>) {
  const scope = agencyScope(ctx, f.agencyId);
  const conds: any[] = [];
  if (scope) conds.push(eq(s.bookings.agencyId, scope));
  if (f.status) conds.push(eq(s.bookings.bookingStatus, f.status));
  if (f.source) conds.push(eq(s.bookings.source, f.source));
  if (f.provider) conds.push(eq(s.bookings.provider, f.provider));
  if (f.from) conds.push(gte(s.bookings.bookedAt, f.from));
  if (f.to) conds.push(lte(s.bookings.bookedAt, f.to));
  if (f.route) conds.push(like(s.bookings.routeSummary, `%${f.route.toUpperCase()}%`));
  if (f.airline) conds.push(like(s.bookings.airlineSummary, `%${f.airline.toUpperCase()}%`));
  let rows = db.select().from(s.bookings).where(conds.length ? and(...conds) : undefined).orderBy(desc(s.bookings.bookedAt), s.bookings.id).limit(f.limit).all();
  const ids = rows.map((r) => r.id);
  const pnrs = ids.length ? db.select().from(s.pnrRecords).where(inArray(s.pnrRecords.bookingId, ids)).all() : [];
  const tix = ids.length ? db.select().from(s.tickets).where(inArray(s.tickets.bookingId, ids)).all() : [];
  const ag = Object.fromEntries(db.select().from(s.agencies).all().map((a) => [a.id, a.displayName]));
  let out = rows.map((b) => ({ ...b, agencyName: ag[b.agencyId], gdsPnr: pnrs.find((p) => p.bookingId === b.id)?.gdsPnr ?? null, ticketNumbers: tix.filter((t) => t.bookingId === b.id).map((t) => t.ticketNumber), bookingSnapshotJson: undefined }));
  if (f.q) { const q = f.q.trim().toUpperCase(); out = out.filter((b) => b.id.toUpperCase().includes(q) || (b.gdsPnr ?? '').includes(q) || b.leadPassenger.toUpperCase().includes(q) || b.ticketNumbers.some((t) => t.includes(q))); }
  return out;
}
export function bookingDetail(db: Tx, ctx: SessionCtx, id: string) {
  const b = db.select().from(s.bookings).where(eq(s.bookings.id, id)).get();
  if (!b) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
  assertOwned(ctx, b.agencyId);
  const segs = db.select().from(s.bookingSegments).where(eq(s.bookingSegments.bookingId, id)).orderBy(s.bookingSegments.legIndex).all();
  const showTickets = ['TICKETED', 'CANCELLED', 'VOIDED'].includes(b.bookingStatus);
  const tix = showTickets ? db.select().from(s.tickets).where(eq(s.tickets.bookingId, id)).all() : [];
  const claim = db.select().from(s.refundClaims).where(eq(s.refundClaims.bookingId, id)).get();
  const receipts = claim ? db.select().from(s.supplierSettlementEvents).where(eq(s.supplierSettlementEvents.refundId, claim.id)).all() : [];
  const ag = db.select().from(s.agencies).where(eq(s.agencies.id, b.agencyId)).get();
  const wallet = db.select().from(s.walletLedgerEntries).where(eq(s.walletLedgerEntries.bookingId, id)).orderBy(s.walletLedgerEntries.createdAt).all();
  const credit = db.select().from(s.creditLedgerEntries).where(eq(s.creditLedgerEntries.bookingId, id)).orderBy(s.creditLedgerEntries.createdAt).all();
  return {
    bookingId: b.id, agencyId: b.agencyId, agencyName: ag?.displayName, source: b.source, bookingStatus: b.bookingStatus, ticketStatus: b.ticketStatus, paymentStatus: b.paymentStatus, fundingType: b.fundingType,
    gdsProvider: b.provider === 'SABRE' ? 'SABRE_MOCK' : b.provider, pcc: b.pcc, tripType: b.tripType, bookedAt: b.bookedAt, firstDepartureAt: b.firstDepartureAt, routeSummary: b.routeSummary, failureReason: b.failureReason,
    amount: { amountMinor: b.sellAmountMinor, currency: 'INR' }, supplierCost: isHub(ctx) ? { amountMinor: b.supplierCostMinor, currency: 'INR' } : undefined,
    refundPolicySnapshot: { policyId: b.refundPolicyId, version: b.refundPolicyVersion, payoutMode: b.refundPayoutMode },
    snapshot: JSON.parse(b.bookingSnapshotJson),
    pnr: db.select().from(s.pnrRecords).where(eq(s.pnrRecords.bookingId, id)).get() ?? null,
    tickets: tix.map((t) => ({ ticketNumber: t.ticketNumber, status: t.status, issuedAt: t.issuedAt, imported: t.imported })),
    passengers: db.select().from(s.passengers).where(eq(s.passengers.bookingId, id)).all(),
    segments: segs.map((g) => ({ ...g, fareRuleSnapshot: JSON.parse(g.fareRuleSnapshotJson), priceComponents: JSON.parse(g.priceComponentsJson), fareRuleSnapshotJson: undefined, priceComponentsJson: undefined, segmentSupplierCostMinor: isHub(ctx) ? g.segmentSupplierCostMinor : undefined })),
    reservation: db.select().from(s.fundingReservations).where(eq(s.fundingReservations.bookingId, id)).get() ?? null,
    walletEntries: wallet, creditEntries: credit,
    cancellation: db.select().from(s.cancellations).where(eq(s.cancellations.bookingId, id)).get() ?? null,
    refundClaim: claim ? { ...claim, timeline: JSON.parse(claim.timelineJson), receipts, supplierExpectedMinor: claim.supplierExpectedMinor } : null,
    amendments: db.select().from(s.amendmentCases).where(eq(s.amendmentCases.bookingId, id)).all(),
    supportCases: db.select().from(s.supportCases).where(eq(s.supportCases.bookingId, id)).all(),
    audit: isHub(ctx) || true ? db.select().from(s.auditEvents).where(and(eq(s.auditEvents.entityType, 'booking'), eq(s.auditEvents.entityId, id))).orderBy(s.auditEvents.occurredAt).all().map((a) => ({ action: a.action, actorRole: a.actorRole, occurredAt: a.occurredAt })) : [],
    demo: true,
  };
}
export { or };
