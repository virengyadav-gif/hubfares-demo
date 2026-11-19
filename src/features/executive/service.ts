/** Read-only executive views (WF-19). Every figure is derived from canonical records at request time. */
import { eq, desc } from 'drizzle-orm';
import * as s from '@/server/db/schema';
import type { Tx } from '@/server/db/util';
import { kpisFor, KpiFilter, cohortRows } from './kpis';
import { fundingPosition } from '@/features/wallet-credit/position';
import { nowIso } from '@/shared/time';

export function overview(db: Tx, f: KpiFilter) {
  const total = kpisFor(db, f);
  const agencies = db.select().from(s.agencies).all().filter((a) => !f.agencyId || a.id === f.agencyId);
  const byAgency = agencies.map((a) => {
    const k = kpisFor(db, { ...f, agencyId: a.id });
    const pos = fundingPosition(db, a.id, nowIso());
    return { agencyId: a.id, agencyName: a.displayName, status: a.status, ...k, creditOutstandingMinor: pos.creditOutstandingMinor, overdueMinor: pos.overdueMinor, creditLimitMinor: pos.creditLimitMinor, creditBlocked: pos.creditBlocked, walletCashMinor: pos.walletCashMinor };
  });
  const credit = byAgency.reduce((a, x) => ({ outstanding: a.outstanding + x.creditOutstandingMinor, overdue: a.overdue + x.overdueMinor, limit: a.limit + x.creditLimitMinor }), { outstanding: 0, overdue: 0, limit: 0 });
  return { total, byAgency, credit, dateBasis: 'booking date', period: { from: f.from ?? null, to: f.to ?? null } };
}
export type Granularity = 'daily' | 'weekly' | 'monthly';
/** Bucket label for a timestamp: day (YYYY-MM-DD), ISO week starting Monday (week of YYYY-MM-DD) or month (YYYY-MM). */
export function bucketKey(iso: string, g: Granularity): string {
  const d = iso.slice(0, 10);
  if (g === 'monthly') return d.slice(0, 7);
  if (g === 'weekly') { const t = new Date(`${d}T00:00:00Z`); const dow = (t.getUTCDay() + 6) % 7; return new Date(t.getTime() - dow * 86400000).toISOString().slice(0, 10); }
  return d;
}
export function salesTrends(db: Tx, f: KpiFilter & { granularity?: Granularity }) {
  const d = cohortRows(db, f);
  const tix = new Set(d.tix.map((t) => t.bookingId));
  const ticketed = d.rows.filter((b) => tix.has(b.id));
  const byDay: Record<string, { date: string; gbvMinor: number; bookings: number; cancellations: number }> = {};
  const bucket = (iso: string) => bucketKey(iso, f.granularity ?? 'daily');
  for (const b of ticketed) { const k = bucket(b.bookedAt); (byDay[k] ??= { date: k, gbvMinor: 0, bookings: 0, cancellations: 0 }); byDay[k].gbvMinor += b.sellAmountMinor; byDay[k].bookings++; if (b.bookingStatus === 'CANCELLED') byDay[k].cancellations++; }
  const group = (key: (b: typeof ticketed[number]) => string) => Object.values(ticketed.reduce((m, b) => { const k = key(b); (m[k] ??= { key: k, gbvMinor: 0, bookings: 0, cancelled: 0, voided: 0 }); m[k].gbvMinor += b.sellAmountMinor; m[k].bookings++; if (b.bookingStatus === 'CANCELLED') m[k].cancelled++; if (b.bookingStatus === 'VOIDED') m[k].voided++; return m; }, {} as Record<string, any>)).sort((a: any, b: any) => b.gbvMinor - a.gbvMinor);
  const INTL = new Set(['LHR', 'SIN', 'DXB', 'FRA']);
  return { daily: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)), byRoute: group((b) => b.routeSummary), byAirline: group((b) => b.airlineSummary), byJourney: group((b) => (b.routeSummary.split('-').some((x) => INTL.has(x)) ? 'International' : 'Domestic')), bySource: group((b) => b.source), granularity: f.granularity ?? 'daily', dateBasis: 'booking date' };
}
export function cancellations(db: Tx, f: KpiFilter) {
  const d = cohortRows(db, f);
  const ag = Object.fromEntries(db.select().from(s.agencies).all().map((a) => [a.id, a.displayName]));
  const bk = Object.fromEntries(d.rows.map((b) => [b.id, b]));
  const now = Date.parse(nowIso());
  const claims = d.claims.map((c) => ({ ...c, agencyName: ag[c.agencyId], route: bk[c.bookingId]?.routeSummary, ageDays: Math.floor((now - Date.parse(c.createdAt)) / 86400000), timelineJson: undefined }));
  const t = kpisFor(db, f);
  const agencies = [...new Set(d.rows.map((b) => b.agencyId))].map((id: string) => { const k = kpisFor(db, { ...f, agencyId: id }); return { agencyId: id as string, agencyName: ag[id], ticketed: k.ticketedCount, cancelled: k.cancelledCount, voided: k.voidedCount, cancellationRatePct: k.cancellationRatePct, voidRatePct: k.voidRatePct }; });
  const aging = [{ bucket: '0–1 days', min: 0, max: 1 }, { bucket: '2–3 days', min: 2, max: 3 }, { bucket: '4+ days', min: 4, max: 9999 }].map((b) => ({ bucket: b.bucket, pendingAgencyMinor: claims.filter((c) => c.ageDays >= b.min && c.ageDays <= b.max && c.agencyPayoutStatus !== 'CREDITED').reduce((a, c) => a + c.agencyRefundMinor, 0), supplierReceivableMinor: claims.filter((c) => c.ageDays >= b.min && c.ageDays <= b.max && c.supplierStatus !== 'RECEIVED').reduce((a, c) => a + Math.max(0, c.supplierExpectedMinor - c.supplierReceivedMinor), 0) }));
  return { totals: { ticketed: t.ticketedCount, cancelled: t.cancelledCount, voided: t.voidedCount, cancellationRatePct: t.cancellationRatePct, voidRatePct: t.voidRatePct, agencyRefundPendingMinor: t.agencyRefundPendingMinor, supplierReceivableMinor: t.supplierReceivableMinor, agencyRefundObligationMinor: t.agencyRefundObligationMinor }, byAgency: agencies, claims, aging, definition: 'Cancellation rate = CANCELLED ÷ historically ticketed (booking-date cohort); VOIDED excluded from numerator, shown separately.' };
}
export function creditRisk(db: Tx) {
  const at = nowIso();
  const ag = db.select().from(s.agencies).all();
  const rows = ag.map((a) => ({ ...fundingPosition(db, a.id, at), agencyName: a.displayName }));
  const payments = db.select().from(s.paymentEvents).orderBy(desc(s.paymentEvents.receivedAt)).all();
  const k = kpisFor(db, {});
  const walletTrend = db.select().from(s.walletLedgerEntries).orderBy(s.walletLedgerEntries.createdAt).all().reduce((m, e) => { const d = e.createdAt.slice(0, 10); (m[d] ??= { date: d, creditsMinor: 0, debitsMinor: 0 }); if (e.direction === 'CREDIT') m[d].creditsMinor += e.amountMinor; else m[d].debitsMinor += e.amountMinor; return m; }, {} as Record<string, any>);
  return { agencies: rows, unmatchedPayments: payments.filter((p) => ['UNMATCHED', 'EXCEPTION', 'REJECTED', 'RECEIVED'].includes(p.status)).map((p) => ({ id: p.id, ref: p.externalPaymentRef, amountMinor: p.grossAmountMinor, currency: p.currency, status: p.status, reason: JSON.parse(p.matchingJson).reason ?? null })), agencyRefundPendingMinor: k.agencyRefundPendingMinor, supplierReceivableMinor: k.supplierReceivableMinor, walletTrend: Object.values(walletTrend) };
}
export function operations(db: Tx) {
  const apps = db.select().from(s.registrationApplications).all();
  const cases = db.select().from(s.supportCases).all();
  const now = Date.parse(nowIso());
  const approved = apps.filter((a) => a.decisionTime && a.submitTime);
  const bookings = db.select().from(s.bookings).all();
  const claims = db.select().from(s.refundClaims).all();
  const users = Object.fromEntries(db.select().from(s.users).all().map((u) => [u.id, u.name]));
  const workload = Object.values(cases.filter((c) => !['CLOSED', 'RESOLVED'].includes(c.status)).reduce((m, c) => { const k = c.assignedTo ? users[c.assignedTo] : 'Unassigned'; (m[k] ??= { assignee: k, open: 0 }); m[k].open++; return m; }, {} as Record<string, any>));
  return {
    pendingApplications: apps.filter((a) => ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED'].includes(a.status)).length,
    avgApprovalHours: approved.length ? approved.reduce((a, x) => a + (Date.parse(x.decisionTime!) - Date.parse(x.submitTime!)) / 3600000, 0) / approved.length : null,
    openCases: cases.filter((c) => !['CLOSED', 'RESOLVED'].includes(c.status)).length,
    slaBreached: cases.filter((c) => !['CLOSED', 'RESOLVED'].includes(c.status) && c.slaDueAt && Date.parse(c.slaDueAt) < now).length,
    casesByStatus: Object.values(cases.reduce((m, c) => { (m[c.status] ??= { status: c.status, count: 0 }); m[c.status].count++; return m; }, {} as Record<string, any>)),
    casesByCategory: Object.values(cases.reduce((m, c) => { (m[c.category] ??= { category: c.category, count: 0 }); m[c.category].count++; return m; }, {} as Record<string, any>)),
    ticketingIssues: bookings.filter((b) => ['BOOKING_FAILED', 'TICKETING_FAILED'].includes(b.bookingStatus)).length,
    pendingTicketing: bookings.filter((b) => b.bookingStatus === 'PNR_CREATED').length,
    refundsPendingSupplier: claims.filter((c) => c.supplierStatus === 'PENDING').length,
    workload,
  };
}
export function drilldownBookings(db: Tx, f: KpiFilter & { status?: string }) {
  const d = cohortRows(db, f);
  const tix = new Set(d.tix.map((t) => t.bookingId));
  return d.rows.filter((b) => !f.status || b.bookingStatus === f.status).map((b) => ({ id: b.id, agencyId: b.agencyId, route: b.routeSummary, airline: b.airlineSummary, bookedAt: b.bookedAt, status: b.bookingStatus, source: b.source, ticketed: tix.has(b.id), sellMinor: b.sellAmountMinor, supplierCostMinor: b.supplierCostMinor, claim: d.claims.find((c) => c.bookingId === b.id) ?? null }));
}
export { eq };
