/** Cancellation, refund claims, supplier receipt and authorised payout (WF-11..13, Technical Design §4.7/§4.7a). */
import { and, eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { nextId, nextCode, nextSeq, audit, domainEvent, notify, Tx } from '@/server/db/util';
import { withIdempotency } from '@/server/idempotency';
import type { SessionCtx } from '@/server/auth/session';
import { assertOwned, agencyScope, isHub } from '@/server/auth/authorize';
import { AppError, NEUTRAL_NOT_FOUND } from '@/shared/errors';
import { nowIso, nowMs } from '@/shared/time';
import { computeCancellation, CancelQuote } from './calc';
import type { FareRuleProfile } from '@/features/fares/rules';
import { loadFixture } from '@/server/db/seed';

export const cancelSchema = z.object({ mode: z.enum(['CANCEL', 'VOID']).default('CANCEL'), passengerIds: z.array(z.string()).max(9).optional() });

function ownedBooking(tx: Tx, ctx: SessionCtx, bookingId: string) {
  const b = tx.select().from(s.bookings).where(eq(s.bookings.id, bookingId)).get();
  if (!b) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
  assertOwned(ctx, b.agencyId);
  return b;
}
/** Mock void eligibility: the simulator only permits the explicitly seeded void (HFB1004, already voided). */
function voidEligibility(_b: typeof s.bookings.$inferSelect) {
  return { eligible: false, reason: 'Void window has closed for this ticket — use cancellation.' };
}
export type PartialInfo = { selectedPassengers: { id: string; name: string; ticketNumber: string | null }[]; remainingPassengers: { id: string; name: string }[]; totalPassengers: number; perPassenger: { refundMinor: number; penaltyMinor: number; serviceFeeMinor: number; paidMinor: number } };
/** Resolve a passenger selection: undefined / all passengers ⇒ full cancellation; a strict subset ⇒ PNR split + partial cancel. */
function selectionFor(tx: Tx, ctx: SessionCtx, bookingId: string, passengerIds?: string[]) {
  ownedBooking(tx, ctx, bookingId);
  const pax = tx.select().from(s.passengers).where(eq(s.passengers.bookingId, bookingId)).orderBy(s.passengers.id).all();
  if (!passengerIds || passengerIds.length === 0) return { partial: false, selectedIds: pax.map((p) => p.id), pax };
  const uniq = [...new Set(passengerIds)];
  if (uniq.some((id) => !pax.find((p) => p.id === id))) throw new AppError('VALIDATION_ERROR', 'Select passengers from this booking only');
  return { partial: uniq.length < pax.length, selectedIds: uniq, pax };
}
export function cancellationQuote(tx: Tx, ctx: SessionCtx, bookingId: string, mode: 'CANCEL' | 'VOID', passengerIds?: string[]): CancelQuote & { bookingId: string; mode: string; payoutPolicy: string; bookedRefundPolicyId: string; bookedRefundPolicyVersion: number; voidEligibility: { eligible: boolean; reason: string }; eligible: boolean; ineligibleReason: string | null; estimatedOnly: true; source: 'SIMULATED'; evaluatedAt: string; partial?: PartialInfo } {
  const b = ownedBooking(tx, ctx, bookingId);
  const segs = tx.select().from(s.bookingSegments).where(eq(s.bookingSegments.bookingId, bookingId)).orderBy(s.bookingSegments.legIndex).all();
  const sel = selectionFor(tx, ctx, bookingId, passengerIds);
  const n = Math.max(1, sel.pax.length);
  const k = sel.partial ? sel.selectedIds.length : n;
  const q = computeCancellation(segs.map((g) => ({ legIndex: g.legIndex, origin: g.origin, destination: g.destination, departureAt: g.departureAt, segmentSellMinor: shareOf(g.segmentSellMinor, k, n), segmentSupplierCostMinor: shareOf(g.segmentSupplierCostMinor, k, n), profile: JSON.parse(g.fareRuleSnapshotJson) as FareRuleProfile, adults: k })), nowMs());
  let partial: PartialInfo | undefined;
  if (sel.partial) {
    const tix = tx.select().from(s.tickets).where(eq(s.tickets.bookingId, bookingId)).all();
    partial = {
      selectedPassengers: sel.pax.filter((p) => sel.selectedIds.includes(p.id)).map((p) => ({ id: p.id, name: p.displayName, ticketNumber: tix.find((t) => t.passengerId === p.id)?.ticketNumber ?? null })),
      remainingPassengers: sel.pax.filter((p) => !sel.selectedIds.includes(p.id)).map((p) => ({ id: p.id, name: p.displayName })),
      totalPassengers: n,
      perPassenger: { refundMinor: Math.round(q.estimatedAgencyRefundMinor / k), penaltyMinor: Math.round(q.supplierPenaltyMinor / k), serviceFeeMinor: Math.round(q.serviceFeeMinor / k), paidMinor: Math.round(q.agencyAmountPaidMinor / k) },
    };
  }
  const v = voidEligibility(b);
  let reason: string | null = null;
  if (b.bookingStatus === 'CANCELLED' || b.bookingStatus === 'VOIDED') reason = `Booking is already ${b.bookingStatus.toLowerCase()}`;
  else if (b.bookingStatus !== 'TICKETED') reason = 'Only ticketed bookings can be cancelled (no ticket has been issued)';
  else if (q.allDeparted) reason = 'All segments have departed — no-show rules apply; cancellation is not available';
  else if (mode === 'VOID' && !v.eligible) reason = v.reason;
  else if (sel.partial && mode === 'VOID') reason = 'Partial void is not supported — use cancellation';
  else if (sel.partial && tx.select().from(s.tickets).where(eq(s.tickets.bookingId, bookingId)).all().filter((t) => sel.selectedIds.includes(t.passengerId ?? '') && t.status === 'ISSUED').length !== sel.selectedIds.length) reason = 'Every selected passenger must hold an issued ticket';
  return { ...q, partial, bookingId, mode, payoutPolicy: b.refundPayoutMode, bookedRefundPolicyId: b.refundPolicyId, bookedRefundPolicyVersion: b.refundPolicyVersion, voidEligibility: v, eligible: !reason, ineligibleReason: reason, estimatedOnly: true, source: 'SIMULATED', evaluatedAt: nowIso() };
}

export function confirmCancellation(db: DB, ctx: SessionCtx, bookingId: string, mode: 'CANCEL' | 'VOID', idemKey: string, passengerIds?: string[]) {
  return db.transaction((tx) => withIdempotency(tx, 'booking.cancel_confirm', `${bookingId}:${idemKey}`, { userId: ctx.userId, agencyId: ctx.agencyId }, { bookingId, mode, passengerIds: passengerIds ?? null }, () => {
    const sel = selectionFor(tx, ctx, bookingId, passengerIds);
    if (sel.partial) {
      if (mode !== 'CANCEL') throw new AppError('VALIDATION_ERROR', 'Partial cancellation supports cancel only');
      const pq = cancellationQuote(tx, ctx, bookingId, 'CANCEL', sel.selectedIds);
      if (!pq.eligible) throw new AppError('INVALID_STATE', pq.ineligibleReason!);
      const split = splitBooking(tx, ctx, bookingId, sel.selectedIds);
      const r = cancelInTx(tx, ctx, split.childBookingId, 'CANCEL', idemKey);
      return { ...r, partial: true, parentBookingId: bookingId, childBookingId: split.childBookingId, childPnr: split.childPnr, parentPnr: split.parentPnr, cancelledPassengers: split.movedPassengers, remainingPassengers: split.remainingPassengers };
    }
    return cancelInTx(tx, ctx, bookingId, mode, idemKey);
  }));
}
function cancelInTx(tx: Tx, ctx: SessionCtx, bookingId: string, mode: 'CANCEL' | 'VOID', idemKey: string) {
  {
    const q = cancellationQuote(tx, ctx, bookingId, mode);
    if (!q.eligible) throw new AppError('INVALID_STATE', q.ineligibleReason!);
    const b = ownedBooking(tx, ctx, bookingId);
    if (tx.select().from(s.cancellations).where(eq(s.cancellations.bookingId, bookingId)).get()) throw new AppError('INVALID_STATE', 'A cancellation already exists for this booking');
    const at = nowIso();
    const snap = JSON.parse(b.bookingSnapshotJson);
    const autoLimit = snap.refundPolicy?.autoApproveLimitMinor ?? Number.MAX_SAFE_INTEGER;
    const cxl = nextId(tx, 'cxl');
    tx.insert(s.cancellations).values({ id: cxl, bookingId, agencyId: b.agencyId, mode, quoteSnapshotJson: JSON.stringify(q), segmentSlabBreakdownJson: JSON.stringify(q.segments), estimatedRefundMinor: q.estimatedAgencyRefundMinor, status: 'CONFIRMED', idempotencyKey: idemKey, requestedAt: at, requestedBy: ctx.userId }).run();
    tx.update(s.bookings).set({ bookingStatus: 'CANCELLED', ticketStatus: 'CANCELLED', paymentStatus: q.estimatedAgencyRefundMinor > 0 ? 'REFUND_PENDING' : 'CHARGED', updatedAt: at }).where(eq(s.bookings.id, bookingId)).run();
    tx.update(s.tickets).set({ status: 'CANCELLED' }).where(eq(s.tickets.bookingId, bookingId)).run();
    const claimId = nextCode(tx, 'RFD', 2000);
    const refund = q.estimatedAgencyRefundMinor;
    const timeline: any[] = [{ at, status: 'REQUESTED' }, { at, status: 'VALIDATED', note: `Slabs ${q.segments.map((x) => `${x.route}:${x.slab}`).join(', ')}` }];
    let payoutStatus = 'PENDING', claimStatus = 'PENDING_SUPPLIER', walletEntry: string | null = null, credited = 0;
    if (refund === 0) { payoutStatus = 'NOT_APPLICABLE'; claimStatus = 'CLOSED_NONREFUNDABLE'; timeline.push({ at, status: 'CLOSED', note: 'Non-refundable slab — zero refund' }); }
    else if (b.refundPayoutMode === 'IMMEDIATE_IF_ELIGIBLE') {
      if (refund <= autoLimit) {
        timeline.push({ at, status: 'APPROVED', note: `Auto-approved under booked policy ${b.refundPolicyId} v${b.refundPolicyVersion}` });
        walletEntry = nextId(tx, 'wle');
        tx.insert(s.walletLedgerEntries).values({ id: walletEntry, agencyId: b.agencyId, type: 'REFUND_CREDIT', direction: 'CREDIT', amountMinor: refund, currency: 'INR', bookingId, refundId: claimId, description: `Refund credit · ${claimId} (immediate-eligible policy)`, idempotencyKey: `refund-payout:${claimId}`, createdAt: at }).run();
        credited = refund; payoutStatus = 'CREDITED'; claimStatus = 'PAID_SUPPLIER_PENDING';
        timeline.push({ at, status: 'WALLET_CREDITED', amountMinor: refund });
        tx.update(s.bookings).set({ paymentStatus: 'REFUNDED' }).where(eq(s.bookings.id, bookingId)).run();
      } else { payoutStatus = 'APPROVAL_PENDING'; claimStatus = 'APPROVAL_PENDING'; timeline.push({ at, status: 'APPROVAL_PENDING', note: 'Above auto-approve limit — Finance approval required' }); }
    } else { timeline.push({ at, status: 'APPROVED', note: `Booked policy ${b.refundPolicyId} v${b.refundPolicyVersion}: payout after supplier settlement` }, { at, status: 'PENDING_SUPPLIER' }); }
    tx.insert(s.refundClaims).values({
      id: claimId, bookingId, agencyId: b.agencyId, cancellationId: cxl, refundPolicyId: b.refundPolicyId, refundPolicyVersion: b.refundPolicyVersion, payoutMode: b.refundPayoutMode,
      agencyRefundMinor: refund, supplierExpectedMinor: q.supplierExpectedMinor, supplierReceivedMinor: 0, walletCreditedMinor: credited,
      agencyPayoutStatus: payoutStatus, supplierStatus: q.supplierExpectedMinor > 0 ? 'PENDING' : 'NOT_APPLICABLE', status: claimStatus, walletLedgerEntryId: walletEntry,
      idempotencyKey: idemKey, createdAt: at, updatedAt: at, timelineJson: JSON.stringify(timeline),
    }).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'BOOKING_CANCELLED', 'booking', bookingId, b.agencyId, { claimId, refundMinor: refund, payoutMode: b.refundPayoutMode, policy: `${b.refundPolicyId} v${b.refundPolicyVersion}` });
    domainEvent(tx, 'booking.cancelled', 'booking', bookingId, b.agencyId, { claimId, refundMinor: refund });
    notify(tx, { audience: 'AGENCY', agencyId: b.agencyId, kind: 'CANCELLED', referenceId: claimId, title: `Cancellation confirmed for ${b.routeSummary}; refund ${payoutStatus === 'CREDITED' ? 'credited to wallet' : 'pending'}` });
    notify(tx, { audience: 'HUB', agencyId: b.agencyId, kind: 'REFUND_CLAIM', referenceId: claimId, title: `New refund claim ${claimId} (${b.refundPayoutMode})` });
    return { bookingId, cancellationId: cxl, claimId, refundMinor: refund, agencyPayoutStatus: payoutStatus, claimStatus, walletCreditedMinor: credited, supplierStatus: q.supplierExpectedMinor > 0 ? 'PENDING' : 'NOT_APPLICABLE', supplierExpectedMinor: q.supplierExpectedMinor, penaltyMinor: q.supplierPenaltyMinor, serviceFeeMinor: q.serviceFeeMinor, partial: false as boolean };
  }
}

/** Proportional share of an amount for k of n passengers (exact for per-passenger priced bookings). */
export function shareOf(amount: number, k: number, n: number) { return k === n ? amount : Math.round((amount * k) / n); }

/**
 * PNR split (GDS "divide"): selected passengers + their tickets move to a new child booking with its own PNR;
 * the remaining passengers stay on the original booking/PNR. Amounts are apportioned per passenger.
 * No ledger movement — funds were charged once on the original booking.
 */
export function splitBooking(tx: Tx, ctx: SessionCtx, bookingId: string, passengerIds: string[]) {
  const b = ownedBooking(tx, ctx, bookingId);
  if (b.bookingStatus !== 'TICKETED') throw new AppError('INVALID_STATE', 'Only ticketed bookings can be split');
  const pax = tx.select().from(s.passengers).where(eq(s.passengers.bookingId, bookingId)).orderBy(s.passengers.id).all();
  const n = pax.length, k = passengerIds.length;
  if (n < 2 || k < 1 || k >= n) throw new AppError('VALIDATION_ERROR', 'Select at least one passenger and leave at least one on the booking');
  const at = nowIso();
  const children = tx.select().from(s.bookings).where(eq(s.bookings.parentBookingId, bookingId)).all().length;
  const childId = `${bookingId}-S${children + 1}`;
  const parentPnr = tx.select().from(s.pnrRecords).where(eq(s.pnrRecords.bookingId, bookingId)).get();
  const childPnr = `SBS${String(nextSeq(tx, 'pnr_split')).padStart(3, '0')}`;
  const segs = tx.select().from(s.bookingSegments).where(eq(s.bookingSegments.bookingId, bookingId)).orderBy(s.bookingSegments.legIndex).all();
  const moved = pax.filter((p) => passengerIds.includes(p.id));
  const remaining = pax.filter((p) => !passengerIds.includes(p.id));
  let childSell = 0, childCost = 0;
  const childSegs = segs.map((g) => {
    const sell = shareOf(g.segmentSellMinor, k, n), cost = shareOf(g.segmentSupplierCostMinor, k, n);
    childSell += sell; childCost += cost;
    const pc = JSON.parse(g.priceComponentsJson);
    return { g, sell, cost, pc };
  });
  const snap = JSON.parse(b.bookingSnapshotJson);
  tx.insert(s.bookings).values({
    ...b, id: childId, parentBookingId: bookingId, sellAmountMinor: childSell, supplierCostMinor: childCost, leadPassenger: moved[0].displayName, updatedAt: at,
    bookingSnapshotJson: JSON.stringify({ ...snap, passengers: { adults: k, children: 0, infants: 0 }, splitFrom: { bookingId, pnr: parentPnr?.gdsPnr ?? null, at, passengers: moved.map((p) => p.displayName) } }),
  }).run();
  for (const { g, sell, cost, pc } of childSegs) {
    tx.insert(s.bookingSegments).values({ ...g, id: `${childId}_seg${g.legIndex}`, bookingId: childId, segmentSellMinor: sell, segmentSupplierCostMinor: cost, priceComponentsJson: JSON.stringify({ ...pc, adults: k }) }).run();
    tx.update(s.bookingSegments).set({ segmentSellMinor: g.segmentSellMinor - sell, segmentSupplierCostMinor: g.segmentSupplierCostMinor - cost, priceComponentsJson: JSON.stringify({ ...pc, adults: n - k }) }).where(eq(s.bookingSegments.id, g.id)).run();
  }
  for (const p of moved) {
    tx.update(s.passengers).set({ bookingId: childId }).where(eq(s.passengers.id, p.id)).run();
    tx.update(s.tickets).set({ bookingId: childId }).where(and(eq(s.tickets.bookingId, bookingId), eq(s.tickets.passengerId, p.id))).run();
  }
  if (parentPnr) tx.insert(s.pnrRecords).values({ id: `${childId}_pnr`, bookingId: childId, provider: parentPnr.provider, pcc: parentPnr.pcc, gdsPnr: childPnr, airlinePnr: parentPnr.airlinePnr, imported: parentPnr.imported, createdAt: at }).run();
  tx.update(s.bookings).set({ sellAmountMinor: b.sellAmountMinor - childSell, supplierCostMinor: b.supplierCostMinor - childCost, leadPassenger: remaining[0].displayName, updatedAt: at,
    bookingSnapshotJson: JSON.stringify({ ...snap, passengers: { adults: n - k, children: 0, infants: 0 }, splits: [...(snap.splits ?? []), { childBookingId: childId, childPnr, at, passengers: moved.map((p) => p.displayName) }] }) }).where(eq(s.bookings.id, bookingId)).run();
  audit(tx, { userId: ctx.userId, role: ctx.role }, 'PNR_SPLIT', 'booking', bookingId, b.agencyId, { childBookingId: childId, childPnr, passengers: moved.map((p) => p.displayName) });
  audit(tx, { userId: ctx.userId, role: ctx.role }, 'PNR_SPLIT_CREATED', 'booking', childId, b.agencyId, { parentBookingId: bookingId, parentPnr: parentPnr?.gdsPnr, passengers: moved.map((p) => p.displayName) });
  domainEvent(tx, 'booking.split', 'booking', bookingId, b.agencyId, { childBookingId: childId });
  return { childBookingId: childId, childPnr, parentPnr: parentPnr?.gdsPnr ?? null, movedPassengers: moved.map((p) => p.displayName), remainingPassengers: remaining.map((p) => p.displayName) };
}

export function listClaims(db: Tx, ctx: SessionCtx, agencyId?: string) {
  const scope = agencyScope(ctx, agencyId);
  const rows = db.select().from(s.refundClaims).where(scope ? eq(s.refundClaims.agencyId, scope) : undefined).orderBy(desc(s.refundClaims.createdAt)).all();
  const bk = Object.fromEntries(db.select().from(s.bookings).all().map((b) => [b.id, b]));
  const ag = Object.fromEntries(db.select().from(s.agencies).all().map((a) => [a.id, a.displayName]));
  const pnr = Object.fromEntries(db.select().from(s.pnrRecords).all().map((p) => [p.bookingId, p.gdsPnr]));
  const receipts = db.select().from(s.supplierSettlementEvents).all();
  const scen = availableSettlementScenarios();
  return rows.map((c) => ({ ...c, timeline: JSON.parse(c.timelineJson), timelineJson: undefined, agencyName: ag[c.agencyId], route: bk[c.bookingId]?.routeSummary, gdsPnr: pnr[c.bookingId] ?? null, receipts: receipts.filter((r) => r.refundId === c.id), supplierScenarios: isHub(ctx) ? scen.filter((x) => x.refundClaimId === c.id || (x.generic && c.supplierStatus === 'PENDING')).map((x) => ({ ...x, amountMinor: x.generic ? c.supplierExpectedMinor : x.amountMinor, externalRef: x.generic ? `SUPRF-${c.id.toUpperCase()}` : x.externalRef })) : undefined }));
}
export function getClaim(db: Tx, ctx: SessionCtx, id: string) {
  const c = db.select().from(s.refundClaims).where(eq(s.refundClaims.id, id)).get();
  if (!c) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
  assertOwned(ctx, c.agencyId);
  return { ...c, timeline: JSON.parse(c.timelineJson), receipts: db.select().from(s.supplierSettlementEvents).where(eq(s.supplierSettlementEvents.refundId, id)).all() };
}
type Scenario = { id: string; refundClaimId: string; externalRef: string; amountMinor: number; supplierId: string; generic?: boolean; note?: string };
export function availableSettlementScenarios(): Scenario[] {
  const r = loadFixture('refunds.json');
  const fixed = r.supplierReceiptScenarios.filter((x: any) => !x.initiallyPosted);
  // Generic full-expected receipt for claims created live during the demo (amount = claim's own expected supplier refund).
  return [...fixed, { id: 'settle_live_full', refundClaimId: '*', externalRef: '', amountMinor: 0, supplierId: 'supplier_sabre_mock', generic: true, note: 'Full expected supplier refund for a live demo claim' }];
}

export const settlementSchema = z.object({ scenarioId: z.string() });
/** Guided supplier receipt: persists mock receipt + match/exception. NEVER credits the OTA wallet. */
export function postSupplierSettlement(db: DB, ctx: SessionCtx, claimId: string, scenarioId: string, idemKey: string) {
  return db.transaction((tx) => withIdempotency(tx, 'refund.supplier_settlement', `${claimId}:${idemKey}`, { userId: ctx.userId, agencyId: null }, { claimId, scenarioId }, () => {
    const c = tx.select().from(s.refundClaims).where(eq(s.refundClaims.id, claimId)).get();
    if (!c) throw new AppError('NOT_FOUND', 'Refund claim not found');
    const sc = availableSettlementScenarios().find((x) => x.id === scenarioId && (x.refundClaimId === claimId || x.generic));
    if (!sc) throw new AppError('VALIDATION_ERROR', 'Settlement scenario does not apply to this claim');
    const amount = sc.generic ? c.supplierExpectedMinor : sc.amountMinor;
    const ref = sc.generic ? `SUPRF-${c.id.toUpperCase()}` : sc.externalRef;
    const existing = tx.select().from(s.supplierSettlementEvents).where(and(eq(s.supplierSettlementEvents.supplierId, sc.supplierId), eq(s.supplierSettlementEvents.externalRef, ref))).get();
    if (existing) return { claimId, replay: true, settlementEventId: existing.id, status: existing.status, walletCreditPosted: false, message: 'Replay of an already recorded supplier event — no new settlement row' };
    if (c.supplierStatus === 'RECEIVED') throw new AppError('INVALID_STATE', 'Supplier refund already received for this claim');
    if (c.supplierExpectedMinor === 0) throw new AppError('INVALID_STATE', 'No supplier refund is expected on this claim');
    const at = nowIso();
    const matched = amount === c.supplierExpectedMinor;
    const evId = nextId(tx, 'sse');
    tx.insert(s.supplierSettlementEvents).values({ id: evId, refundId: claimId, supplierId: sc.supplierId, externalRef: ref, amountMinor: amount, status: matched ? 'MATCHED' : 'EXCEPTION', receivedAt: at, note: matched ? 'Simulated supplier receipt matched expected amount' : `Expected ${c.supplierExpectedMinor}, received ${amount} — Operations exception` }).run();
    const tl = JSON.parse(c.timelineJson);
    let status = c.status;
    if (matched) {
      tl.push({ at, status: 'SUPPLIER_FUNDS_RECEIVED', amountMinor: amount, note: `Mock receipt ${ref} (no wallet effect)` });
      if (c.payoutMode === 'SUPPLIER_SETTLEMENT' && c.agencyPayoutStatus !== 'CREDITED') status = 'SUPPLIER_RECEIVED_PAYOUT_ELIGIBLE';
      else if (c.agencyPayoutStatus === 'CREDITED') { status = 'RECONCILED_CLOSED'; tl.push({ at, status: 'RECONCILED_CLOSED' }); }
      tx.update(s.refundClaims).set({ supplierStatus: 'RECEIVED', supplierReceivedMinor: amount, status, updatedAt: at, timelineJson: JSON.stringify(tl) }).where(eq(s.refundClaims.id, claimId)).run();
    } else {
      tl.push({ at, status: 'SUPPLIER_EXCEPTION', amountMinor: amount, note: `Expected ${c.supplierExpectedMinor}` });
      tx.update(s.refundClaims).set({ supplierStatus: 'EXCEPTION', status: c.agencyPayoutStatus === 'CREDITED' ? 'PAID_SUPPLIER_EXCEPTION' : 'SUPPLIER_EXCEPTION', updatedAt: at, timelineJson: JSON.stringify(tl) }).where(eq(s.refundClaims.id, claimId)).run();
      notify(tx, { audience: 'HUB', agencyId: c.agencyId, kind: 'SUPPLIER_EXCEPTION', referenceId: claimId, title: `Supplier settlement mismatch on ${claimId}` });
    }
    audit(tx, { userId: ctx.userId, role: ctx.role }, matched ? 'SUPPLIER_RECEIPT_MATCHED' : 'SUPPLIER_RECEIPT_EXCEPTION', 'refund_claim', claimId, c.agencyId, { ref, amountMinor: amount });
    return { claimId, replay: false, settlementEventId: evId, status: matched ? 'MATCHED' : 'EXCEPTION', walletCreditPosted: false };
  }));
}

/** Authorised, idempotent agency payout. One REFUND_CREDIT per claim, ever. */
export function payoutRefund(db: DB, ctx: SessionCtx, claimId: string, idemKey: string) {
  return db.transaction((tx) => withIdempotency(tx, 'refund.payout', `${claimId}:${idemKey}`, { userId: ctx.userId, agencyId: null }, { claimId }, () => {
    const c = tx.select().from(s.refundClaims).where(eq(s.refundClaims.id, claimId)).get();
    if (!c) throw new AppError('NOT_FOUND', 'Refund claim not found');
    if (c.agencyPayoutStatus === 'CREDITED' || c.walletLedgerEntryId) return { claimId, alreadyCredited: true, walletLedgerEntryId: c.walletLedgerEntryId, amountMinor: c.walletCreditedMinor };
    const eligibleSupplier = c.payoutMode === 'SUPPLIER_SETTLEMENT' && c.supplierStatus === 'RECEIVED' && c.supplierReceivedMinor === c.supplierExpectedMinor;
    const eligibleApproval = c.payoutMode === 'IMMEDIATE_IF_ELIGIBLE' && c.agencyPayoutStatus === 'APPROVAL_PENDING';
    if (!eligibleSupplier && !eligibleApproval) throw new AppError('INVALID_STATE', c.payoutMode === 'SUPPLIER_SETTLEMENT' ? 'Payout requires a fully matched supplier receipt first (booked policy: supplier settlement)' : 'Claim is not awaiting payout');
    if (c.agencyRefundMinor <= 0) throw new AppError('INVALID_STATE', 'Nothing to pay out');
    const at = nowIso();
    const wle = nextId(tx, 'wle');
    tx.insert(s.walletLedgerEntries).values({ id: wle, agencyId: c.agencyId, type: 'REFUND_CREDIT', direction: 'CREDIT', amountMinor: c.agencyRefundMinor, currency: 'INR', bookingId: c.bookingId, refundId: c.id, description: `Refund credit · ${c.id} (authorised payout)`, idempotencyKey: `refund-payout:${c.id}`, createdAt: at }).run();
    const tl = JSON.parse(c.timelineJson);
    tl.push({ at, status: 'WALLET_CREDITED', amountMinor: c.agencyRefundMinor, note: `Authorised by ${ctx.role}` });
    const closed = c.supplierStatus === 'RECEIVED' || c.supplierStatus === 'NOT_APPLICABLE';
    if (closed) tl.push({ at, status: 'RECONCILED_CLOSED' });
    tx.update(s.refundClaims).set({ agencyPayoutStatus: 'CREDITED', walletCreditedMinor: c.agencyRefundMinor, walletLedgerEntryId: wle, status: closed ? 'RECONCILED_CLOSED' : 'PAID_SUPPLIER_PENDING', updatedAt: at, timelineJson: JSON.stringify(tl) }).where(eq(s.refundClaims.id, claimId)).run();
    tx.update(s.bookings).set({ paymentStatus: 'REFUNDED', updatedAt: at }).where(eq(s.bookings.id, c.bookingId)).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'REFUND_PAYOUT', 'refund_claim', claimId, c.agencyId, { amountMinor: c.agencyRefundMinor, walletLedgerEntryId: wle });
    domainEvent(tx, 'refund.paid', 'refund_claim', claimId, c.agencyId, { amountMinor: c.agencyRefundMinor });
    notify(tx, { audience: 'AGENCY', agencyId: c.agencyId, kind: 'REFUND_CREDITED', referenceId: claimId, title: `Refund ₹${(c.agencyRefundMinor / 100).toFixed(2)} credited to wallet (${claimId})` });
    return { claimId, alreadyCredited: false, walletLedgerEntryId: wle, amountMinor: c.agencyRefundMinor };
  }));
}
