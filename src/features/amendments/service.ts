/**
 * Date-change amendment with ticket reissue (P1-23/24).
 * Quote = airline change fee (booked fare-rule date-change slab, per passenger) + fare difference (deterministic
 * by days-to-new-departure) + Hubfares service fee. Confirm debits wallet/credit once, moves the segment to the new
 * date, exchanges the old tickets and issues new ticket numbers. Idempotent.
 */
import { and, eq, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { nextId, nextCode, nextSeq, audit, domainEvent, notify, Tx } from '@/server/db/util';
import { withIdempotency } from '@/server/idempotency';
import type { SessionCtx } from '@/server/auth/session';
import { agencyScope, assertOwned, requireActiveAgency, isHub } from '@/server/auth/authorize';
import { AppError, NEUTRAL_NOT_FOUND } from '@/shared/errors';
import { nowIso, nowMs, isoPlus, DAY } from '@/shared/time';
import { localYmd } from '@/shared/time/zones';
import { classifySlab, FareRuleProfile, SLAB_LABEL } from '@/features/fares/rules';
import { fundingPosition, allocateFunding } from '@/features/wallet-credit/position';
import { effectivePolicy, creditCfg } from '@/features/wallet-credit/policies';
import { gdsAdapter } from '@/server/providers/gds/sabre-mock';

export const SERVICE_FEE_PER_PAX_MINOR = 5000;
export const dateChangeSchema = z.object({ bookingId: z.string().min(3), legIndex: z.number().int().min(0).max(1).default(0), newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a valid date') });
export const confirmDateChangeSchema = dateChangeSchema.extend({ expectedTotalMinor: z.number().int().min(0) });

/** Fare difference as basis points of the per-passenger segment fare, by days from today to the new departure. */
export function fareDifferenceBps(daysAhead: number): number {
  if (daysAhead <= 3) return 1500;
  if (daysAhead <= 7) return 1000;
  if (daysAhead <= 14) return 600;
  if (daysAhead <= 30) return 250;
  return 0;
}
const roundTo10Rupees = (minor: number) => Math.round(minor / 1000) * 1000;

function ymdDiffDays(a: string, b: string) { return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY); }

export function dateChangeQuote(db: Tx, ctx: SessionCtx, i: z.infer<typeof dateChangeSchema>) {
  const b = db.select().from(s.bookings).where(eq(s.bookings.id, i.bookingId)).get();
  if (!b) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
  assertOwned(ctx, b.agencyId);
  const segs = db.select().from(s.bookingSegments).where(eq(s.bookingSegments.bookingId, b.id)).orderBy(s.bookingSegments.legIndex).all();
  const seg = segs.find((g) => g.legIndex === i.legIndex);
  if (!seg) throw new AppError('VALIDATION_ERROR', 'This booking has no such flight leg');
  const adults = Math.max(1, db.select().from(s.passengers).where(eq(s.passengers.bookingId, b.id)).all().length);
  const profile = JSON.parse(seg.fareRuleSnapshotJson) as FareRuleProfile;
  const now = nowMs();
  const fromDate = localYmd(seg.departureAt, seg.originTz);
  const shiftDays = ymdDiffDays(fromDate, i.newDate);
  const toDepartureAt = isoPlus(seg.departureAt, shiftDays * DAY);
  const toArrivalAt = isoPlus(seg.arrivalAt, shiftDays * DAY);
  const slab = classifySlab(seg.departureAt, now);
  let reason: string | null = null;
  if (b.bookingStatus !== 'TICKETED') reason = 'Date change is available for ticketed bookings only';
  else if (b.source === 'MANUAL_DEMO') reason = 'Offline bookings are changed directly with the supplier';
  else if (slab === 'NO_SHOW') reason = 'This flight has already departed — date change is not permitted';
  else if (shiftDays === 0) reason = 'Choose a date different from the current travel date';
  else if (Date.parse(toDepartureAt) - now < 6 * 3600_000) reason = 'The new departure must be at least 6 hours from now';
  else if (Date.parse(toDepartureAt) - now > 330 * DAY) reason = 'The new date must be within the next 330 days';
  else if (segs.length === 2 && i.legIndex === 0 && Date.parse(toArrivalAt) >= Date.parse(segs[1].departureAt)) reason = 'The outbound flight must arrive before the return flight departs';
  else if (segs.length === 2 && i.legIndex === 1 && Date.parse(toDepartureAt) <= Date.parse(segs[0].arrivalAt)) reason = 'The return flight must depart after the outbound flight arrives';
  const ds = slab === 'NO_SHOW' ? null : profile.dateChangeSlabs.find((x) => x.id === slab) ?? null;
  if (!reason && ds && !ds.permitted) reason = `Date change is not permitted ${SLAB_LABEL[slab].toLowerCase()} before departure (${profile.label} fare)`;
  const daysAhead = Math.ceil((Date.parse(toDepartureAt) - now) / DAY);
  const bps = fareDifferenceBps(daysAhead);
  const perPaxFare = Math.round(seg.segmentSellMinor / adults);
  const perPaxDiff = roundTo10Rupees((perPaxFare * bps) / 10000);
  const perPaxFee = ds?.supplierPenaltyMinor ?? 0;
  const breakdown = { fareDifferenceMinor: perPaxDiff * adults, airlineChangeFeeMinor: perPaxFee * adults, serviceFeeMinor: SERVICE_FEE_PER_PAX_MINOR * adults };
  const totalMinor = breakdown.fareDifferenceMinor + breakdown.airlineChangeFeeMinor + breakdown.serviceFeeMinor;
  const pos = fundingPosition(db, b.agencyId, nowIso());
  const alloc = allocateFunding(pos, totalMinor);
  return {
    bookingId: b.id, legIndex: seg.legIndex, route: `${seg.origin}-${seg.destination}`, airline: seg.airline, flightNumber: seg.flightNumber,
    fromDate, toDate: i.newDate, fromDepartureAt: seg.departureAt, toDepartureAt, toArrivalAt, originTz: seg.originTz, destinationTz: seg.destinationTz,
    slab, slabLabel: SLAB_LABEL[slab], profileId: profile.id, profileLabel: profile.label, adults, daysAhead,
    perPassenger: { fareDifferenceMinor: perPaxDiff, airlineChangeFeeMinor: perPaxFee, serviceFeeMinor: SERVICE_FEE_PER_PAX_MINOR },
    breakdown, totalMinor, permitted: !reason, reason,
    funding: alloc ? { walletMinor: alloc.walletHold, creditMinor: alloc.creditHold, sufficient: true } : { walletMinor: 0, creditMinor: 0, sufficient: false, availableMinor: pos.spendingPowerMinor },
  };
}

export function confirmDateChange(db: DB, ctx: SessionCtx, i: z.infer<typeof confirmDateChangeSchema>, idemKey: string) {
  if (!isHub(ctx)) requireActiveAgency(ctx);
  return db.transaction((tx) => withIdempotency(tx, 'amendment.date_change', `${i.bookingId}:${idemKey}`, { userId: ctx.userId, agencyId: ctx.agencyId }, i, () => {
    const q = dateChangeQuote(tx, ctx, i);
    if (!q.permitted) throw new AppError('INVALID_STATE', q.reason!);
    if (q.totalMinor !== i.expectedTotalMinor) throw new AppError('PRICE_CHANGED', `The change charge is now ₹${(q.totalMinor / 100).toFixed(2)} — review the updated quote`, { totalMinor: q.totalMinor });
    if (!q.funding.sufficient) throw new AppError('INSUFFICIENT_FUNDS', `Insufficient balance: need ₹${(q.totalMinor / 100).toFixed(2)}, available ₹${((q.funding.availableMinor ?? 0) / 100).toFixed(2)}`);
    const b = tx.select().from(s.bookings).where(eq(s.bookings.id, i.bookingId)).get()!;
    const seg = tx.select().from(s.bookingSegments).where(and(eq(s.bookingSegments.bookingId, b.id), eq(s.bookingSegments.legIndex, i.legIndex))).get()!;
    const at = nowIso();
    const id = nextCode(tx, 'AMD', 2000);
    const desc = `Date change ${id} · ${q.route} ${q.fromDate} → ${q.toDate}`;
    if (q.funding.walletMinor > 0) tx.insert(s.walletLedgerEntries).values({ id: nextId(tx, 'wle'), agencyId: b.agencyId, type: 'AMENDMENT_DEBIT', direction: 'DEBIT', amountMinor: q.funding.walletMinor, currency: 'INR', bookingId: b.id, description: desc, idempotencyKey: `amd:${id}`, createdAt: at }).run();
    if (q.funding.creditMinor > 0) {
      const cp = creditCfg(effectivePolicy(tx, b.agencyId, 'CREDIT', at));
      tx.insert(s.creditLedgerEntries).values({ id: nextId(tx, 'cle'), agencyId: b.agencyId, type: 'DRAW', direction: 'DRAW', amountMinor: q.funding.creditMinor, bookingId: b.id, dueAt: isoPlus(at, cp.termDays * DAY), description: `Credit draw · ${desc}`, idempotencyKey: `amd:${id}`, createdAt: at }).run();
    }
    tx.update(s.bookingSegments).set({ departureAt: q.toDepartureAt, arrivalAt: q.toArrivalAt, segmentSellMinor: seg.segmentSellMinor + q.breakdown.fareDifferenceMinor, segmentSupplierCostMinor: seg.segmentSupplierCostMinor + q.breakdown.fareDifferenceMinor }).where(eq(s.bookingSegments.id, seg.id)).run();
    const firstDep = i.legIndex === 0 ? q.toDepartureAt : b.firstDepartureAt;
    const snap = JSON.parse(b.bookingSnapshotJson);
    tx.update(s.bookings).set({ firstDepartureAt: firstDep, sellAmountMinor: b.sellAmountMinor + q.totalMinor, supplierCostMinor: b.supplierCostMinor + q.breakdown.fareDifferenceMinor + q.breakdown.airlineChangeFeeMinor, updatedAt: at,
      bookingSnapshotJson: JSON.stringify({ ...snap, amendments: [...(snap.amendments ?? []), { id, type: 'DATE_CHANGE', at, fromDate: q.fromDate, toDate: q.toDate, totalMinor: q.totalMinor }] }) }).where(eq(s.bookings.id, b.id)).run();
    // Exchange old tickets and reissue one new ticket per passenger.
    const pax = tx.select().from(s.passengers).where(eq(s.passengers.bookingId, b.id)).orderBy(s.passengers.id).all();
    const old = tx.select().from(s.tickets).where(and(eq(s.tickets.bookingId, b.id), eq(s.tickets.status, 'ISSUED'))).all();
    if (old.length) tx.update(s.tickets).set({ status: 'EXCHANGED' }).where(inArray(s.tickets.id, old.map((t) => t.id))).run();
    const r = gdsAdapter('SABRE').issueTicket('normal', 900000 + nextSeq(tx, 'ticket') * 10, pax.length);
    if (!r.ok) throw new AppError('TICKETING_SIM_FAILURE', r.message);
    const reissue = nextSeq(tx, `reissue:${b.id}`);
    r.ticketNumbers.forEach((t, n) => tx.insert(s.tickets).values({ id: `${b.id}_tkt_r${reissue}_${n + 1}`, bookingId: b.id, passengerId: pax[n]?.id ?? null, ticketNumber: t, issuedAt: at, status: 'ISSUED', imported: false }).run());
    const record = { ...q, amendmentId: id, newTickets: r.ticketNumbers, exchangedTickets: old.map((t) => t.ticketNumber), completedAt: at };
    tx.insert(s.amendmentCases).values({ id, agencyId: b.agencyId, bookingId: b.id, type: 'DATE_CHANGE', status: 'COMPLETED', quoteJson: JSON.stringify(record), createdBy: ctx.userId, createdAt: at, updatedAt: at,
      timelineJson: JSON.stringify([{ at, status: 'QUOTED', note: `Total ₹${(q.totalMinor / 100).toFixed(2)}` }, { at, status: 'CONFIRMED', note: 'Charged to agency account' }, { at, status: 'TICKET_REISSUED', note: r.ticketNumbers.join(', ') }, { at, status: 'COMPLETED' }]) }).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'TICKET_REISSUED', 'booking', b.id, b.agencyId, { amendmentId: id, fromDate: q.fromDate, toDate: q.toDate, totalMinor: q.totalMinor, newTickets: r.ticketNumbers, exchangedTickets: old.map((t) => t.ticketNumber) });
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'AMENDMENT_COMPLETED', 'amendment', id, b.agencyId, { bookingId: b.id, totalMinor: q.totalMinor });
    domainEvent(tx, 'booking.reissued', 'booking', b.id, b.agencyId, { amendmentId: id, amountMinor: q.totalMinor });
    notify(tx, { audience: 'AGENCY', agencyId: b.agencyId, kind: 'AMENDMENT_COMPLETED', referenceId: b.id, title: `Date changed for ${b.id} (${q.route}) to ${q.toDate} · new ticket(s) ${r.ticketNumbers.join(', ')}` });
    notify(tx, { audience: 'HUB', agencyId: b.agencyId, kind: 'AMENDMENT_COMPLETED', referenceId: b.id, title: `Ticket reissued on ${b.id} after date change ${id}` });
    return { amendmentId: id, bookingId: b.id, status: 'COMPLETED', totalMinor: q.totalMinor, walletDebitMinor: q.funding.walletMinor, creditDrawMinor: q.funding.creditMinor, newTickets: r.ticketNumbers, exchangedTickets: old.map((t) => t.ticketNumber), toDepartureAt: q.toDepartureAt };
  }));
}

export function listAmendments(db: Tx, ctx: SessionCtx) {
  const scope = agencyScope(ctx);
  const ag = Object.fromEntries(db.select().from(s.agencies).all().map((a) => [a.id, a.displayName]));
  return db.select().from(s.amendmentCases).where(scope ? eq(s.amendmentCases.agencyId, scope) : undefined).orderBy(desc(s.amendmentCases.createdAt), desc(s.amendmentCases.id)).all()
    .map((a) => ({ ...a, agencyName: ag[a.agencyId], quote: JSON.parse(a.quoteJson), timeline: JSON.parse(a.timelineJson), quoteJson: undefined, timelineJson: undefined }));
}
