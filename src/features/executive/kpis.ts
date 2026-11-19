/** Executive booking-cohort KPIs (Technical Design §4.10). All values derived from canonical records at request time. */
import { and, inArray, gte, lte, eq } from 'drizzle-orm';
import { bookings, tickets, refundClaims, supplierSettlementEvents, modeledCosts, bookingSegments, agencies, coreCommercialRules } from '@/server/db/schema';
import type { Tx } from '@/server/db/util';

export type KpiFilter = { from?: string; to?: string; agencyId?: string; airline?: string; route?: string; journey?: 'DOMESTIC' | 'INTERNATIONAL' };
const INTL = new Set(['LHR', 'SIN', 'DXB', 'FRA']);

export function cohortRows(db: Tx, f: KpiFilter) {
  const conds = [] as any[];
  if (f.from) conds.push(gte(bookings.bookedAt, f.from));
  if (f.to) conds.push(lte(bookings.bookedAt, f.to.length === 10 ? `${f.to}T23:59:59.999Z` : f.to));
  if (f.agencyId) conds.push(eq(bookings.agencyId, f.agencyId));
  let rows = db.select().from(bookings).where(conds.length ? and(...conds) : undefined).all();
  if (f.airline) rows = rows.filter((b) => b.airlineSummary.split('/').includes(f.airline!));
  if (f.route) rows = rows.filter((b) => b.routeSummary === f.route);
  if (f.journey) rows = rows.filter((b) => { const [o, d] = b.routeSummary.split('-'); const intl = INTL.has(o) || INTL.has(d); return f.journey === 'INTERNATIONAL' ? intl : !intl; });
  const ids = rows.map((b) => b.id);
  const tix = ids.length ? db.select().from(tickets).where(inArray(tickets.bookingId, ids)).all() : [];
  const claims = ids.length ? db.select().from(refundClaims).where(inArray(refundClaims.bookingId, ids)).all() : [];
  const claimIds = claims.map((c) => c.id);
  const receipts = claimIds.length ? db.select().from(supplierSettlementEvents).where(and(inArray(supplierSettlementEvents.refundId, claimIds), eq(supplierSettlementEvents.status, 'MATCHED'))).all() : [];
  const costs = ids.length ? db.select().from(modeledCosts).where(inArray(modeledCosts.bookingId, ids)).all() : [];
  return { rows, tix, claims, receipts, costs };
}

export type AgencyKpi = ReturnType<typeof computeKpis>;
export function computeKpis(data: ReturnType<typeof cohortRows>, rebateByBooking: Map<string, number> = new Map()) {
  const ticketedIds = new Set(data.tix.map((t) => t.bookingId));
  const ticketed = data.rows.filter((b) => ticketedIds.has(b.id) && b.sellAmountMinor > 0);
  const tset = new Set(ticketed.map((b) => b.id));
  const gbv = ticketed.reduce((a, b) => a + b.sellAmountMinor, 0);
  const initialSupplierCost = ticketed.reduce((a, b) => a + b.supplierCostMinor, 0);
  const claims = data.claims.filter((c) => tset.has(c.bookingId));
  const agencyRefunds = claims.reduce((a, c) => a + c.agencyRefundMinor, 0);
  const walletRefundPaid = claims.reduce((a, c) => a + c.walletCreditedMinor, 0);
  const supplierExpected = claims.reduce((a, c) => a + c.supplierExpectedMinor, 0);
  const claimIds = new Set(claims.map((c) => c.id));
  const supplierReceived = data.receipts.filter((r) => claimIds.has(r.refundId)).reduce((a, r) => a + r.amountMinor, 0);
  const variable = data.costs.filter((c) => tset.has(c.bookingId)).reduce((a, c) => a + c.amountMinor, 0);
  const rebates = ticketed.reduce((a, b) => a + (rebateByBooking.get(b.id) ?? 0), 0);
  const retainedAgencySales = gbv - agencyRefunds;
  const retainedSupplierCost = initialSupplierCost - supplierReceived;
  const netPlatformRevenue = retainedAgencySales - retainedSupplierCost - rebates - 0;
  const contribution = netPlatformRevenue - variable;
  const cancelled = ticketed.filter((b) => b.bookingStatus === 'CANCELLED').length;
  const voided = ticketed.filter((b) => b.bookingStatus === 'VOIDED').length;
  return {
    bookingsTotal: data.rows.length, ticketedCount: ticketed.length, cancelledCount: cancelled, voidedCount: voided,
    pnrUnticketedCount: data.rows.filter((b) => b.bookingStatus === 'PNR_CREATED').length,
    failedCount: data.rows.filter((b) => b.bookingStatus === 'BOOKING_FAILED' || b.bookingStatus === 'TICKETING_FAILED').length,
    grossBookingValueMinor: gbv, initialSupplierCostMinor: initialSupplierCost, agencyRefundObligationMinor: agencyRefunds,
    agencyWalletRefundPaidMinor: walletRefundPaid, agencyRefundPendingMinor: agencyRefunds - walletRefundPaid,
    supplierExpectedRefundMinor: supplierExpected, supplierReceivedRefundMinor: supplierReceived, supplierReceivableMinor: Math.max(0, supplierExpected - supplierReceived),
    retainedAgencySalesMinor: retainedAgencySales, retainedSupplierCostMinor: retainedSupplierCost, agencyRebateExpenseMinor: rebates, passThroughExpenseMinor: 0,
    netPlatformRevenueMinor: netPlatformRevenue, variableOperatingExpenseMinor: variable, estimatedContributionMinor: contribution,
    contributionMarginPct: retainedAgencySales > 0 ? (contribution / retainedAgencySales) * 100 : null,
    cancellationRatePct: ticketed.length ? (cancelled / ticketed.length) * 100 : null,
    voidRatePct: ticketed.length ? (voided / ticketed.length) * 100 : null,
    activeOtas: new Set(ticketed.map((b) => b.agencyId)).size,
    averageBookingValueMinor: ticketed.length ? Math.round(gbv / ticketed.length) : null,
  };
}
/** Rebate accrual per booking from portal segment snapshots (zero in baseline fixtures). */
export function rebatesFor(db: Tx, bookingIds: string[]): Map<string, number> {
  const m = new Map<string, number>();
  if (!bookingIds.length) return m;
  for (const s of db.select().from(bookingSegments).where(inArray(bookingSegments.bookingId, bookingIds)).all()) {
    const pc = JSON.parse(s.priceComponentsJson);
    if (pc.rebateMinor) m.set(s.bookingId, (m.get(s.bookingId) ?? 0) + pc.rebateMinor);
  }
  return m;
}
export function kpisFor(db: Tx, f: KpiFilter) {
  const data = cohortRows(db, f);
  return computeKpis(data, rebatesFor(db, data.rows.map((r) => r.id)));
}
export { agencies, coreCommercialRules };
