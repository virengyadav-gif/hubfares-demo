import { describe, it, expect, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { freshDb, call, U, resetTokens } from '../helpers';
import * as s from '@/server/db/schema';
import { getDb } from '@/server/db/client';
import * as cat from '@/app/api/v1/reports/catalog/route';
import * as dl from '@/app/api/v1/reports/[type]/download/route';
import * as exec from '@/app/api/v1/executive/[view]/route';
import * as helpCfg from '@/app/api/v1/help/config/route';
import * as intent from '@/app/api/v1/help/intent/route';
import * as cases from '@/app/api/v1/help/cases/route';
import * as caseList from '@/app/api/v1/support-cases/route';
import * as caseOne from '@/app/api/v1/support-cases/[id]/route';
import * as amend from '@/app/api/v1/amendments/route';
import * as amendQ from '@/app/api/v1/amendments/quote/route';
import * as amendOne from '@/app/api/v1/amendments/[id]/route';
import * as manual from '@/app/api/v1/manual-orders/route';
import * as reset from '@/app/api/v1/demo/reset/route';
import * as quotes from '@/app/api/v1/quotes/route';
import * as reval from '@/app/api/v1/quotes/[id]/revalidate/route';
import * as bookings from '@/app/api/v1/bookings/route';
import * as issue from '@/app/api/v1/bookings/[id]/issue-ticket/route';
import * as cc from '@/app/api/v1/bookings/[id]/cancel-confirm/route';
import * as payMatch from '@/app/api/v1/payment-events/[id]/match/route';
import * as wallet from '@/app/api/v1/wallet/route';
import { REPORTS } from '@/features/reports/catalog';
import { validateSeededState } from '@/server/db/validate';

let db: ReturnType<typeof freshDb>;
const contract = JSON.parse(fs.readFileSync('fixtures/seed-contract.v1.json', 'utf8'));
async function xlsxRows(as: string, type: string, url?: string) {
  const r = await dl.GET(new Request(`http://localhost${url ?? `/api/v1/reports/${type}/download`}`, { headers: { cookie: `hf_session=${(await import('../helpers')).tokenFor(as)}` } }), { params: Promise.resolve({ type }) });
  expect(r.status).toBe(200);
  expect(r.headers.get('content-type')).toContain('spreadsheetml');
  const buf = Buffer.from(await r.arrayBuffer());
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('Transactions')!;
  const header = (ws.getRow(2).values as any[]).slice(1);
  const rows: Record<string, any>[] = [];
  ws.eachRow((row, n) => { if (n > 2) { const v = (row.values as any[]).slice(1); rows.push(Object.fromEntries(header.map((h, i) => [h, v[i]]))); } });
  return { rows, banner: String(ws.getCell(1, 1).value), buf };
}
async function sha(as: string, type: string) { return crypto.createHash('sha256').update((await xlsxRows(as, type)).rows.map((r) => JSON.stringify(r)).join('\n')).digest('hex'); }

describe('Reports (S-J)', () => {
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('TC-044 Hub roles download six genuine XLSX with 100 sample rows each', async () => {
    const c = await call(cat.GET, { as: U.ops });
    expect(c.data.reports).toHaveLength(6);
    for (const r of REPORTS) {
      const x = await xlsxRows(U.ops, r.type);
      expect(x.rows).toHaveLength(100);
      expect(x.banner).toContain('SAMPLE EXTRACT - NOT LIVE');
    }
    expect((await xlsxRows(U.cxo, 'refund-transactions')).rows).toHaveLength(100);
  });
  it('TC-045 OTA downloads are server-scoped 40/35/25; forged agencyId ignored', async () => {
    for (const [as, id, n] of [[U.sky, 'agency_skyline', 40], [U.orbA, 'agency_orbit', 35], [U.astF, 'agency_aster', 25]] as const) {
      const x = await xlsxRows(as, 'airline-transactions', '/api/v1/reports/airline-transactions/download?agencyId=agency_orbit');
      expect(x.rows).toHaveLength(n);
      expect(x.rows.every((r) => r.AgencyId === id)).toBe(true);
    }
    const c = await call(cat.GET, { as: U.sky });
    expect(c.data.reports.every((r: any) => r.rowCount === 40)).toBe(true);
    expect((await call(dl.GET, { params: { type: 'airline-transactions' } })).status).toBe(401);
  });
  it('TC-046 new booking does not change frozen reports; live CXO does change', async () => {
    const h0 = await sha(U.ops, 'booking-transactions');
    const k0 = (await call(exec.GET, { as: U.cxo, params: { view: 'overview' } })).data.total;
    const q = await call(quotes.POST, { as: U.sky, body: { tripType: 'ONE_WAY', legs: [{ offerId: 'offer_015', brandId: 'brand_015_flex' }], adults: 1 } });
    await call(reval.POST, { as: U.sky, params: { id: q.data.quoteId }, body: {} });
    const b = await call(bookings.POST, { as: U.sky, idem: 'tc046b', body: { quoteId: q.data.quoteId, passengers: [{ title: 'Mr', firstName: 'A', lastName: 'B' }], contactEmail: 'a@example.com' } });
    await call(issue.POST, { as: U.sky, idem: 'tc046t', params: { id: b.data.bookingId }, body: {} });
    expect(await sha(U.ops, 'booking-transactions')).toBe(h0);
    const k1 = (await call(exec.GET, { as: U.cxo, params: { view: 'overview' } })).data.total;
    expect(k1.ticketedCount).toBe(k0.ticketedCount + 1);
  });
});

describe('Executive KPIs (S-L)', () => {
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('TC-063 opening cohort 19 ticketed / 5 cancelled / 1 voided; 5/19 and 1/19; void not in numerator', async () => {
    const c = (await call(exec.GET, { as: U.cxo, params: { view: 'cancellations' } })).data;
    expect(c.totals.ticketed).toBe(19); expect(c.totals.cancelled).toBe(5); expect(c.totals.voided).toBe(1);
    expect(c.totals.cancellationRatePct).toBeCloseTo(26.3158, 3);
    expect(c.totals.voidRatePct).toBeCloseTo(5.2632, 3);
  });
  it('TC-048 ranking reconciles: agency sums equal totals; Orbit is high-volume/lower-margin, Aster highest cancellation', async () => {
    const o = (await call(exec.GET, { as: U.cxo, params: { view: 'overview' } })).data;
    const sum = (k: string) => o.byAgency.reduce((a: number, x: any) => a + x[k], 0);
    for (const k of ['grossBookingValueMinor', 'netPlatformRevenueMinor', 'estimatedContributionMinor', 'ticketedCount']) expect(sum(k)).toBe(o.total[k]);
    const by = Object.fromEntries(o.byAgency.map((a: any) => [a.agencyId, a]));
    expect(by.agency_orbit.grossBookingValueMinor).toBeGreaterThan(by.agency_aster.grossBookingValueMinor);
    expect(by.agency_aster.cancellationRatePct).toBeGreaterThan(by.agency_skyline.cancellationRatePct);
    expect(by.agency_aster.cancellationRatePct).toBeGreaterThan(by.agency_orbit.cancellationRatePct);
    const sky = (await call(exec.GET, { as: U.cxo, params: { view: 'overview' }, url: '/api/v1/executive/overview?agencyId=agency_skyline' })).data.total;
    expect(sky.grossBookingValueMinor).toBe(by.agency_skyline.grossBookingValueMinor);
    const drill = (await call(exec.GET, { as: U.cxo, params: { view: 'drilldown' }, url: '/api/v1/executive/drilldown?agencyId=agency_aster' })).data;
    expect(drill.every((d: any) => d.agencyId === 'agency_aster')).toBe(true);
    expect((await call(exec.GET, { as: U.sky, params: { view: 'overview' } })).status).toBe(403);
  });
  it('TC-049 pending supplier vs credited agency refund and overdue credit are distinct exposures', async () => {
    const r = (await call(exec.GET, { as: U.cxo, params: { view: 'credit-risk' } })).data;
    expect(r.agencyRefundPendingMinor).toBe(contract.expectedKpisAtFullSeedCohort.agencyRefundPendingMinor);
    expect(r.supplierReceivableMinor).toBe(contract.expectedKpisAtFullSeedCohort.supplierReceivableMinor);
    const aster = r.agencies.find((a: any) => a.agencyId === 'agency_aster');
    expect(aster.overdueMinor).toBe(4120000);
    expect(aster.creditBlocked).toBe(true);
  });
  it('TC-047 booking + cancellation on controlled cohort recompute GBV/retained/revenue from records', async () => {
    const k0 = (await call(exec.GET, { as: U.cxo, params: { view: 'overview' } })).data.total;
    const q = await call(quotes.POST, { as: U.sky, body: { tripType: 'ONE_WAY', legs: [{ offerId: 'offer_005', brandId: 'brand_005_saver' }], adults: 1 } });
    await call(reval.POST, { as: U.sky, params: { id: q.data.quoteId }, body: {} });
    const b = await call(bookings.POST, { as: U.sky, idem: 'tc047b', body: { quoteId: q.data.quoteId, passengers: [{ title: 'Mr', firstName: 'A', lastName: 'B' }], contactEmail: 'a@example.com' } });
    await call(issue.POST, { as: U.sky, idem: 'tc047t', params: { id: b.data.bookingId }, body: {} });
    const k1 = (await call(exec.GET, { as: U.cxo, params: { view: 'overview' } })).data.total;
    expect(k1.grossBookingValueMinor - k0.grossBookingValueMinor).toBe(3063250);
    expect(k1.netPlatformRevenueMinor - k0.netPlatformRevenueMinor).toBe(63250);
    expect(k1.estimatedContributionMinor - k0.estimatedContributionMinor).toBe(63250 - 3500);
    await call(cc.POST, { as: U.sky, idem: 'tc047c', params: { id: b.data.bookingId }, body: {} });
    const k2 = (await call(exec.GET, { as: U.cxo, params: { view: 'overview' } })).data.total;
    expect(k2.grossBookingValueMinor).toBe(k1.grossBookingValueMinor);
    expect(k2.cancelledCount).toBe(k1.cancelledCount + 1);
    expect(k1.retainedAgencySalesMinor - k2.retainedAgencySalesMinor).toBe(3063250 - 300000 - 5000);
    expect(k2.supplierReceivableMinor - k1.supplierReceivableMinor).toBe(3000000 - 300000);
    expect(k2.retainedSupplierCostMinor).toBe(k1.retainedSupplierCostMinor);
  });
});

describe('OTA Help chatbot → Operations (S-K)', () => {
  let caseId = '';
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('TC-050 config: 3 languages, 7 main intents, persistent controls; OTA-only', async () => {
    const c = (await call(helpCfg.GET, { as: U.sky })).data;
    expect(c.languages.map((l: any) => l.id)).toEqual(['en', 'hi', 'hinglish']);
    expect(c.menu.map((m: any) => m.id)).toEqual(['CLAIM_REFUND', 'REFUND_STATUS', 'FLIGHT_STATUS', 'CHANGE_FLIGHT', 'MODIFY_BOOKING', 'COMPLAINTS', 'MORE']);
    expect(Object.keys(c.controls)).toEqual(expect.arrayContaining(['back', 'mainMenu', 'restart', 'language', 'close', 'callCenter']));
    expect(c.menu[0].label.hi).toBeTruthy();
    expect((await call(helpCfg.GET, { as: U.ops })).status).toBe(403);
  });
  it('TC-051 own PNR resolves; other agency / unknown PNR → identical neutral not-found', async () => {
    const own = await call(intent.POST, { as: U.sky, body: { action: 'lookup_pnr', pnr: 'SBX001' } });
    expect(own.data.bookingId).toBe('book_seed_001');
    expect(own.data.cancellationEstimate.estimatedAgencyRefundMinor).toBe(740300);
    const other = await call(intent.POST, { as: U.orb, body: { action: 'lookup_pnr', pnr: 'SBX001' } });
    const unknown = await call(intent.POST, { as: U.sky, body: { action: 'lookup_pnr', pnr: 'NOTREAL1' } });
    expect(other.status).toBe(404); expect(unknown.status).toBe(404);
    expect(other.error.message).toBe(unknown.error.message);
    expect(JSON.stringify(other.json)).not.toMatch(/Aarav|BOM-LHR/);
    const st = await call(intent.POST, { as: U.orbA, body: { action: 'lookup_case', reference: 'refund_orb_012' } });
    expect(st.data.agencyPayoutStatus).toBe('CREDITED');
    expect(st.data.supplierSettlementStatus).toBe('PENDING');
  });
  it('TC-052 confirm refund request → one CASE id visible to Ops; booking & ledger untouched; no duplicate', async () => {
    const ledger0 = db.select({ n: sql<number>`count(*)` }).from(s.walletLedgerEntries).get()!.n;
    const r = await call(cases.POST, { as: U.sky, idem: 'tc052', body: { category: 'REFUND_REQUEST', subcategory: 'CANCEL_BOOKING_REFUND', pnr: 'SBX001', details: 'Customer wants to cancel', locale: 'hi' } });
    expect(r.status).toBe(201);
    caseId = r.data.caseId;
    expect(caseId).toMatch(/^CASE-\d{4}$/);
    const again = await call(cases.POST, { as: U.sky, idem: 'tc052', body: { category: 'REFUND_REQUEST', subcategory: 'CANCEL_BOOKING_REFUND', pnr: 'SBX001', details: 'Customer wants to cancel', locale: 'hi' } });
    expect(again.data.caseId).toBe(caseId);
    const ops = (await call(caseList.GET, { as: U.ops, url: '/api/v1/support-cases?source=CHATBOT' })).data;
    const row = ops.find((c: any) => c.id === caseId);
    expect(row.agencyId).toBe('agency_skyline'); expect(row.pnr).toBe('SBX001'); expect(row.category).toBe('REFUND_REQUEST');
    expect(db.select().from(s.bookings).where(eq(s.bookings.id, 'book_seed_001')).get()!.bookingStatus).toBe('TICKETED');
    expect(db.select({ n: sql<number>`count(*)` }).from(s.walletLedgerEntries).get()!.n).toBe(ledger0);
    const foreign = await call(cases.POST, { as: U.orb, idem: 'tc052f', body: { category: 'REFUND_REQUEST', subcategory: 'X', pnr: 'SBX001' } });
    expect(foreign.status).toBe(404);
    expect((await call(cases.POST, { as: U.skyA, idem: 'tc052c', body: { category: 'COMPLAINT', subcategory: 'PAYMENT_ISSUE', details: 'Generic' } })).status).toBe(201);
  });
  it('TC-053 Ops assigns & progresses; OTA sees same timeline; invalid transition rejected', async () => {
    const a = await call(caseOne.PATCH, { as: U.ops, method: 'PATCH', params: { id: caseId }, body: { assignedTo: 'user_hub_ops', note: 'Taking this' } });
    expect(a.data.status).toBe('ASSIGNED');
    expect((await call(caseOne.PATCH, { as: U.ops, method: 'PATCH', params: { id: caseId }, body: { status: 'REOPENED' } })).status).toBe(409);
    await call(caseOne.PATCH, { as: U.ops, method: 'PATCH', params: { id: caseId }, body: { status: 'IN_PROGRESS' } });
    const o = (await call(caseOne.GET, { as: U.sky, params: { id: caseId } })).data;
    expect(o.status).toBe('IN_PROGRESS');
    expect(o.events.length).toBe(3);
    expect((await call(caseOne.PATCH, { as: U.sky, method: 'PATCH', params: { id: caseId }, body: { status: 'CLOSED' } })).status).toBe(403);
    expect((await call(caseOne.GET, { as: U.orb, params: { id: caseId } })).status).toBe(404);
  });
  it('TC-054 guided amendment (fare diff + B profile fee), Ops timeline, manual order: no ticket/ledger', async () => {
    const q = await call(amendQ.POST, { as: U.sky, body: { bookingId: 'book_seed_002', type: 'DATE_CHANGE', optionId: 'opt_plus1' } });
    expect(q.data.amendmentChargeMinor).toBe(200000);
    expect(q.data.guided).toBe(true);
    const a = await call(amend.POST, { as: U.sky, body: { bookingId: 'book_seed_002', type: 'DATE_CHANGE', optionId: 'opt_plus1' } });
    for (const st of ['APPROVED', 'REISSUED_CLOSED']) expect((await call(amendOne.PATCH, { as: U.ops, method: 'PATCH', params: { id: a.data.id }, body: {} })).data.status).toBe(st);
    expect(db.select().from(s.tickets).where(eq(s.tickets.bookingId, 'book_seed_002')).all()).toHaveLength(1);
    const ledger0 = db.select({ n: sql<number>`count(*)` }).from(s.walletLedgerEntries).get()!.n;
    const m = await call(manual.POST, { as: U.ops, body: { agencyId: 'agency_orbit', origin: 'BOM', destination: 'DEL', travelDate: '2026-12-05', airline: 'AI', passengerName: 'Offline Pax', supplierReference: 'SUP-REF-77', amountMinor: 900000 } });
    expect(m.data.status).toBe('MANUAL_RECORDED');
    expect(db.select({ n: sql<number>`count(*)` }).from(s.walletLedgerEntries).get()!.n).toBe(ledger0);
    expect((await call(manual.POST, { as: U.sky, body: { agencyId: 'agency_orbit', origin: 'BOM', destination: 'DEL', travelDate: '2026-12-05', airline: 'AI', passengerName: 'x x x', supplierReference: 'SUP-1', amountMinor: 100000 } })).status).toBe(403);
  });
});

describe('Reset and replay (S-M)', () => {
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('TC-056 reset after booking + refund + payment + case restores canonical state; no leftovers', async () => {
    await call(payMatch.POST, { as: U.fin, params: { id: 'pay_sky_match_001' }, idem: 'tc056p' });
    await call(cc.POST, { as: U.orbA, idem: 'tc056c', params: { id: 'book_seed_011' }, body: {} });
    await call(cases.POST, { as: U.sky, idem: 'tc056h', body: { category: 'COMPLAINT', subcategory: 'OTHER', details: 'x' } });
    expect((await call(reset.POST, { as: U.super, body: { confirm: 'nope' } })).status).toBe(422);
    const r = await call(reset.POST, { as: U.super, body: { confirm: 'RESET DEMO' } });
    expect(r.status, JSON.stringify(r.error)).toBe(200);
    expect(r.data.resetCount).toBe(1);
    expect(db.select().from(s.supportCases).where(eq(s.supportCases.source, 'CHATBOT')).all().map((c) => c.id)).toEqual(['CASE-S005']);
    expect(db.select().from(s.bookings).where(eq(s.bookings.id, 'book_seed_011')).get()!.bookingStatus).toBe('TICKETED');
    expect((await call(wallet.GET, { as: U.skyA })).data.walletCashMinor).toBe(20100000);
    expect(validateSeededState(getDb(), '2026-11-19T12:00:00.000Z').every((c) => c.ok)).toBe(true);
  });
  it('TC-057 / TC-064 two fixed-clock resets produce identical canonical state hashes and the exact oracle', async () => {
    const snapshot = () => {
      const tables = ['bookings', 'booking_segments', 'tickets', 'pnr_records', 'wallet_ledger_entries', 'credit_ledger_entries', 'funding_reservations', 'refund_claims', 'payment_events', 'support_cases', 'agency_policies', 'core_commercial_rules', 'flight_offers', 'fare_brands'];
      return crypto.createHash('sha256').update(tables.map((t) => JSON.stringify(getDb().all(sql.raw(`SELECT * FROM "${t}" ORDER BY id`)))).join('|')).digest('hex');
    };
    const xlsxHash = () => crypto.createHash('sha256').update(fs.readFileSync('fixtures/reports/refund-transactions.xlsx')).digest('hex');
    const x0 = xlsxHash();
    await call(reset.POST, { as: U.super, body: { confirm: 'RESET DEMO' } }); const h1 = snapshot();
    await call(reset.POST, { as: U.super, body: { confirm: 'RESET DEMO' } }); const h2 = snapshot();
    expect(h1).toBe(h2);
    expect(xlsxHash()).toBe(x0);
    const k = (await call(exec.GET, { as: U.cxo, params: { view: 'overview' } })).data.total;
    expect(k.grossBookingValueMinor).toBe(25620000); expect(k.netPlatformRevenueMinor).toBe(594100); expect(k.estimatedContributionMinor).toBe(527600);
    for (const [as, cash] of [[U.skyA, 20100000], [U.orbA, 3890300], [U.astA, 3000000]] as const) expect((await call(wallet.GET, { as })).data.walletCashMinor).toBe(cash);
    expect(db.select().from(s.bookings).all()).toHaveLength(24);
  });
});
