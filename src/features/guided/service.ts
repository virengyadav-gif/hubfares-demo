/** Offline (manual) orders and reference samples. */
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

export function guidedSamples() { return loadFixture('guided-samples.json'); }
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
