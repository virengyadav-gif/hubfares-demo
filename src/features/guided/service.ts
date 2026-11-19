/** Guided (G) flows: amendments/rebooking, manual orders, held carts. No live airline or supplier execution. */
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { nextId, nextCode, audit, Tx } from '@/server/db/util';
import type { SessionCtx } from '@/server/auth/session';
import { agencyScope, assertOwned } from '@/server/auth/authorize';
import { AppError, NEUTRAL_NOT_FOUND } from '@/shared/errors';
import { nowIso, nowMs } from '@/shared/time';
import { loadFixture } from '@/server/db/seed';
import { classifySlab, FareRuleProfile } from '@/features/fares/rules';

export function guidedSamples() { return loadFixture('guided-samples.json'); }
export const amendSchema = z.object({ bookingId: z.string(), type: z.enum(['DATE_CHANGE', 'NAME_CORRECTION', 'REBOOKING', 'ANCILLARY']), optionId: z.string() });
export function amendmentQuote(db: Tx, ctx: SessionCtx, bookingId: string, type: string, optionId: string) {
  const b = db.select().from(s.bookings).where(eq(s.bookings.id, bookingId)).get();
  if (!b) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
  assertOwned(ctx, b.agencyId);
  if (b.bookingStatus !== 'TICKETED') throw new AppError('INVALID_STATE', 'Amendments are available for ticketed bookings only');
  const t = guidedSamples().amendmentOptions.find((x: any) => x.type === type);
  const opt = t?.options.find((o: any) => o.id === optionId);
  if (!opt) throw new AppError('VALIDATION_ERROR', 'Unknown amendment option');
  const seg = db.select().from(s.bookingSegments).where(eq(s.bookingSegments.bookingId, bookingId)).orderBy(s.bookingSegments.legIndex).get()!;
  const profile = JSON.parse(seg.fareRuleSnapshotJson) as FareRuleProfile;
  const slab = classifySlab(seg.departureAt, nowMs());
  let charge = 0; let permitted = true; let note = '';
  if (type === 'DATE_CHANGE' || type === 'REBOOKING') {
    if (slab === 'NO_SHOW') { permitted = false; note = 'Departed — not permitted'; }
    else { const ds = profile.dateChangeSlabs.find((x) => x.id === slab)!; permitted = ds.permitted; charge = ds.supplierPenaltyMinor ?? 0; note = ds.permitted ? `${profile.id} ${slab}: airline change fee + fare difference` : `${profile.id} ${slab}: date change not permitted`; }
  } else note = 'Guided sample charge; airline-dependent in production';
  return { bookingId, type, option: opt, profileId: profile.id, slab, permitted, amendmentChargeMinor: charge, fareDifferenceMinor: opt.fareDifferenceMinor, totalIndicativeMinor: charge + opt.fareDifferenceMinor, note, guided: true, label: 'Guided demo — no ticket is reissued' };
}
export function createAmendment(db: DB, ctx: SessionCtx, i: z.infer<typeof amendSchema>) {
  return db.transaction((tx) => {
    const q = amendmentQuote(tx, ctx, i.bookingId, i.type, i.optionId);
    if (!q.permitted) throw new AppError('INVALID_STATE', q.note);
    const id = nextCode(tx, 'AMD', 2000); const at = nowIso();
    const b = tx.select().from(s.bookings).where(eq(s.bookings.id, i.bookingId)).get()!;
    tx.insert(s.amendmentCases).values({ id, agencyId: b.agencyId, bookingId: i.bookingId, type: i.type, status: 'QUOTED', quoteJson: JSON.stringify(q), createdBy: ctx.userId, createdAt: at, updatedAt: at, timelineJson: JSON.stringify([{ at, status: 'REQUESTED' }, { at, status: 'QUOTED', note: q.note }]) }).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'AMENDMENT_REQUESTED', 'amendment', id, b.agencyId, { type: i.type, guided: true });
    return { id, status: 'QUOTED', quote: q };
  });
}
export function listAmendments(db: Tx, ctx: SessionCtx) {
  const scope = agencyScope(ctx);
  const ag = Object.fromEntries(db.select().from(s.agencies).all().map((a) => [a.id, a.displayName]));
  return db.select().from(s.amendmentCases).where(scope ? eq(s.amendmentCases.agencyId, scope) : undefined).orderBy(desc(s.amendmentCases.createdAt)).all().map((a) => ({ ...a, agencyName: ag[a.agencyId], quote: JSON.parse(a.quoteJson), timeline: JSON.parse(a.timelineJson), quoteJson: undefined, timelineJson: undefined }));
}
const AMD_FLOW: Record<string, string> = { REQUESTED: 'QUOTED', QUOTED: 'APPROVED', APPROVED: 'REISSUED_CLOSED' };
export function advanceAmendment(db: DB, ctx: SessionCtx, id: string, reject = false) {
  return db.transaction((tx) => {
    const a = tx.select().from(s.amendmentCases).where(eq(s.amendmentCases.id, id)).get();
    if (!a) throw new AppError('NOT_FOUND', 'Amendment not found');
    const next = reject ? 'REJECTED' : AMD_FLOW[a.status];
    if (!next) throw new AppError('INVALID_STATE', `Amendment is ${a.status}`);
    const tl = JSON.parse(a.timelineJson); tl.push({ at: nowIso(), status: next, note: next === 'REISSUED_CLOSED' ? 'Guided: simulated reissue recorded — no live ticket change' : undefined });
    tx.update(s.amendmentCases).set({ status: next, timelineJson: JSON.stringify(tl), updatedAt: nowIso() }).where(eq(s.amendmentCases.id, id)).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'AMENDMENT_STATUS', 'amendment', id, a.agencyId, { to: next, guided: true });
    return { id, status: next };
  });
}
export const manualOrderSchema = z.object({ agencyId: z.string(), origin: z.string().trim().toUpperCase().length(3), destination: z.string().trim().toUpperCase().length(3), travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), airline: z.string().trim().toUpperCase().min(2).max(3), passengerName: z.string().trim().min(3).max(60), supplierReference: z.string().trim().min(4).max(30), amountMinor: z.number().int().min(10000).max(100000000) });
/** Guided manual/offline order: identifiable MANUAL_DEMO record; no GDS ticket, no ledger posting, excluded from ticketed KPIs. */
export function createManualOrder(db: DB, ctx: SessionCtx, i: z.infer<typeof manualOrderSchema>) {
  return db.transaction((tx) => {
    const ag = tx.select().from(s.agencies).where(eq(s.agencies.id, i.agencyId)).get();
    if (!ag || ag.status !== 'ACTIVE') throw new AppError('VALIDATION_ERROR', 'Select a valid active agency');
    if (i.origin === i.destination) throw new AppError('VALIDATION_ERROR', 'Incomplete itinerary: origin and destination must differ');
    const id = nextCode(tx, 'HFB', 4000); const at = nowIso(); const dep = `${i.travelDate}T06:00:00.000Z`;
    tx.insert(s.bookings).values({ id, agencyId: i.agencyId, quoteId: null, userId: ctx.userId, source: 'MANUAL_DEMO', provider: 'OFFLINE', pcc: null, tripType: 'ONE_WAY', segmentCount: 1, bookingStatus: 'MANUAL_RECORDED', ticketStatus: 'NOT_ISSUED', paymentStatus: 'NONE', fundingType: 'NONE', bookedAt: at, firstDepartureAt: dep, routeSummary: `${i.origin}-${i.destination}`, airlineSummary: i.airline, leadPassenger: i.passengerName, sellAmountMinor: i.amountMinor, supplierCostMinor: 0, currency: 'INR', refundPolicyId: 'n/a', refundPolicyVersion: 0, refundPayoutMode: 'SUPPLIER_SETTLEMENT', bookingSnapshotJson: JSON.stringify({ manual: true, supplierReference: i.supplierReference, guided: true, note: 'Guided manual order — no supplier execution' }), updatedAt: at }).run();
    tx.insert(s.bookingSegments).values({ id: `${id}_seg0`, bookingId: id, legIndex: 0, direction: 'OUTBOUND', flightOfferId: null, airline: i.airline, airlineName: i.airline, flightNumber: `${i.airline}-OFFLINE`, origin: i.origin, destination: i.destination, departureAt: dep, arrivalAt: dep, originTz: 'Asia/Kolkata', destinationTz: 'Asia/Kolkata', cabin: 'ECONOMY', fareBrandId: null, brandName: 'Manual', fareRuleProfileId: 'A_FLEXIBLE', profileVersion: 1, fareRuleSnapshotJson: tx.select().from(s.fareRuleProfiles).where(eq(s.fareRuleProfiles.id, 'A_FLEXIBLE')).get()!.dataJson, segmentSellMinor: i.amountMinor, segmentSupplierCostMinor: 0, priceComponentsJson: JSON.stringify({ manual: true }) }).run();
    tx.insert(s.passengers).values({ id: `${id}_pax1`, bookingId: id, displayName: i.passengerName, travelerType: 'ADULT', maskedDocReference: null }).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'MANUAL_ORDER_RECORDED', 'booking', id, i.agencyId, { supplierReference: i.supplierReference, guided: true });
    return { bookingId: id, status: 'MANUAL_RECORDED', label: 'Guided demo — offline record only' };
  });
}
