import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, call, U, resetTokens } from '../helpers';
import * as s from '@/server/db/schema';
import * as cq from '@/app/api/v1/bookings/[id]/cancel-quote/route';
import * as cc from '@/app/api/v1/bookings/[id]/cancel-confirm/route';
import * as claims from '@/app/api/v1/refund-claims/route';
import * as payout from '@/app/api/v1/refund-claims/[id]/payout-demo/route';
import * as settle from '@/app/api/v1/refund-claims/[id]/supplier-settlement-demo/route';
import * as wallet from '@/app/api/v1/wallet/route';
import * as passbook from '@/app/api/v1/wallet/passbook/route';
import * as exec from '@/app/api/v1/executive/[view]/route';
import * as policies from '@/app/api/v1/agency-policies/route';
import * as quotes from '@/app/api/v1/quotes/route';
import * as reval from '@/app/api/v1/quotes/[id]/revalidate/route';
import * as bookings from '@/app/api/v1/bookings/route';
import * as bookingOne from '@/app/api/v1/bookings/[id]/route';
import * as issue from '@/app/api/v1/bookings/[id]/issue-ticket/route';
import * as lookup from '@/app/api/v1/pnr-imports/lookup/route';
import * as imp from '@/app/api/v1/pnr-imports/route';
import { setClockOverride } from '@/shared/time';

let db: ReturnType<typeof freshDb>;
const pax = [{ title: 'Mr', firstName: 'Ravi', lastName: 'Demo' }];
async function newBooking(as: string, legs: any[], key: string, tripType = 'ONE_WAY') {
  const q = await call(quotes.POST, { as, body: { tripType, legs, adults: 1 } });
  await call(reval.POST, { as, params: { id: q.data.quoteId }, body: {} });
  const b = await call(bookings.POST, { as, idem: `${key}-b`, body: { quoteId: q.data.quoteId, passengers: pax, contactEmail: 'r@example.com' } });
  await call(issue.POST, { as, idem: `${key}-t`, params: { id: b.data.bookingId }, body: {} });
  return b.data.bookingId as string;
}

describe('S-D cancellation & refund policies', () => {
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('TC-035 HFB1001 A_FLEXIBLE D+12 → S2: 1,047 + 50 disclosed separately; one claim', async () => {
    const q = await call(cq.POST, { as: U.sky, params: { id: 'HFB1001' }, body: { mode: 'CANCEL' } });
    expect(q.data.segments[0].slab).toBe('S2');
    expect(q.data.supplierPenaltyMinor).toBe(104700);
    expect(q.data.serviceFeeMinor).toBe(5000);
    expect(q.data.estimatedAgencyRefundMinor).toBe(740300);
    expect(q.data.bookedRefundPolicyId).toBe('refund_sky_v1');
    const c = await call(cc.POST, { as: U.sky, idem: 'tc035', params: { id: 'HFB1001' }, body: { mode: 'CANCEL' } });
    expect(c.status).toBe(200);
    expect(db.select().from(s.refundClaims).where(eq(s.refundClaims.bookingId, 'HFB1001')).all()).toHaveLength(1);
  });
  it('TC-038 Skyline supplier-settlement: PENDING_SUPPLIER, receivable tracked, NO wallet credit', async () => {
    const claim = db.select().from(s.refundClaims).where(eq(s.refundClaims.bookingId, 'HFB1001')).get()!;
    expect(claim.status).toBe('PENDING_SUPPLIER');
    expect(claim.walletCreditedMinor).toBe(0);
    expect(claim.supplierExpectedMinor).toBe(690300);
    expect(db.select().from(s.walletLedgerEntries).where(eq(s.walletLedgerEntries.refundId, claim.id)).all()).toHaveLength(0);
    const early = await call(payout.POST, { as: U.fin, idem: 'tc038-early', params: { id: claim.id } });
    expect(early.status).toBe(409);
  });
  it('TC-036/TC-039 HFB1011 B_RESTRICTED H+10 → S1: 5,000 + 50; Orbit immediate wallet credit once', async () => {
    const w0 = (await call(wallet.GET, { as: U.orbA })).data;
    const q = await call(cq.POST, { as: U.orbA, params: { id: 'HFB1011' }, body: {} });
    expect(q.data.segments[0].slab).toBe('S1');
    expect(q.data.supplierPenaltyMinor).toBe(500000);
    expect(q.data.estimatedAgencyRefundMinor).toBe(1650000 - 505000);
    const c = await call(cc.POST, { as: U.orbA, idem: 'tc036', params: { id: 'HFB1011' }, body: {} });
    expect(c.data.agencyPayoutStatus).toBe('CREDITED');
    const w1 = (await call(wallet.GET, { as: U.orbA })).data;
    expect(w1.walletCashMinor - w0.walletCashMinor).toBe(1145000);
    expect(w1.creditOutstandingMinor).toBe(w0.creditOutstandingMinor); // refund not offset against credit
    const claim = db.select().from(s.refundClaims).where(eq(s.refundClaims.bookingId, 'HFB1011')).get()!;
    expect(claim.supplierStatus).toBe('PENDING');
  });
  it('TC-037 already cancelled / voided / unticketed → rejected; no second claim or credit', async () => {
    for (const id of ['HFB1001', 'HFB1004', 'HFB1008', 'HFB1009']) {
      const r = await call(cc.POST, { as: U.skyA, idem: `tc037-${id}`, params: { id }, body: {} });
      expect(r.status).toBe(409);
    }
    const replay = await call(cc.POST, { as: U.orbA, idem: 'tc036', params: { id: 'HFB1011' }, body: {} });
    expect(replay.json.meta.idempotentReplay).toBe(true);
    expect(db.select().from(s.walletLedgerEntries).where(eq(s.walletLedgerEntries.bookingId, 'HFB1011')).all().filter((e) => e.type === 'REFUND_CREDIT')).toHaveLength(1);
    const voidQ = await call(cq.POST, { as: U.sky, params: { id: 'HFB1002' }, body: { mode: 'VOID' } });
    expect(voidQ.data.eligible).toBe(false);
  });
  it('TC-062 RFD1003: matched receipt INR 6,903 (no wallet effect) then authorised payout INR 7,403 exactly once', async () => {
    const w0 = (await call(wallet.GET, { as: U.skyA })).data;
    const k0 = (await call(exec.GET, { as: U.cxo, params: { view: 'overview' } })).data.total;
    const r = await call(settle.POST, { as: U.ops, idem: 'tc062-s', params: { id: 'RFD1003' }, body: { scenarioId: 'settle_sky_003' } });
    expect(r.data.status).toBe('MATCHED');
    expect(r.data.walletCreditPosted).toBe(false);
    expect((await call(wallet.GET, { as: U.skyA })).data.walletCashMinor).toBe(w0.walletCashMinor);
    const replay = await call(settle.POST, { as: U.ops, idem: 'tc062-s2', params: { id: 'RFD1003' }, body: { scenarioId: 'settle_sky_003' } });
    expect(replay.data.replay).toBe(true);
    expect(db.select().from(s.supplierSettlementEvents).where(eq(s.supplierSettlementEvents.refundId, 'RFD1003')).all()).toHaveLength(1);
    expect((await call(payout.POST, { as: U.ops, idem: 'tc062-p0', params: { id: 'RFD1003' } })).status).toBe(403);
    const p = await call(payout.POST, { as: U.fin, idem: 'tc062-p', params: { id: 'RFD1003' } });
    expect(p.data.amountMinor).toBe(740300);
    const p2 = await call(payout.POST, { as: U.fin, idem: 'tc062-p2', params: { id: 'RFD1003' } });
    expect(p2.data.alreadyCredited).toBe(true);
    const w1 = (await call(wallet.GET, { as: U.skyA })).data;
    expect(w1.walletCashMinor - w0.walletCashMinor).toBe(740300);
    expect(db.select().from(s.walletLedgerEntries).where(eq(s.walletLedgerEntries.refundId, 'RFD1003')).all()).toHaveLength(1);
    const claim = db.select().from(s.refundClaims).where(eq(s.refundClaims.id, 'RFD1003')).get()!;
    expect(claim.status).toBe('RECONCILED_CLOSED');
    const k1 = (await call(exec.GET, { as: U.cxo, params: { view: 'overview' } })).data.total;
    expect(k1.supplierReceivableMinor).toBe(k0.supplierReceivableMinor - 690300);
    expect(k1.agencyRefundPendingMinor).toBe(k0.agencyRefundPendingMinor - 740300);
    const pb = (await call(passbook.GET, { as: U.skyA })).data;
    expect(pb.entries.some((e: any) => e.refundId === 'RFD1003')).toBe(true);
  });
  it('TC-040 Orbit mismatch receipt INR 12,000 vs 17,553 → exception, no second credit', async () => {
    const before = db.select().from(s.walletLedgerEntries).where(eq(s.walletLedgerEntries.refundId, 'RFD1012')).all().length;
    const r = await call(settle.POST, { as: U.ops, idem: 'tc040', params: { id: 'RFD1012' }, body: { scenarioId: 'settle_orb_mismatch_012' } });
    expect(r.data.status).toBe('EXCEPTION');
    const p = await call(payout.POST, { as: U.fin, idem: 'tc040-p', params: { id: 'RFD1012' } });
    expect(p.data.alreadyCredited).toBe(true);
    expect(db.select().from(s.walletLedgerEntries).where(eq(s.walletLedgerEntries.refundId, 'RFD1012')).all().length).toBe(before);
  });
  it('TC-061 refund policy versioning: old booking keeps v1 supplier-settlement after v2 immediate is published', async () => {
    const oldB = await newBooking(U.sky, [{ offerId: 'offer_001', brandId: 'brand_001_flex' }], 'tc061a');
    const pub = await call(policies.PATCH, { as: U.fin, method: 'PATCH', body: { agencyId: 'agency_skyline', type: 'REFUND', config: { payoutMode: 'IMMEDIATE_IF_ELIGIBLE', autoApproveLimitMinor: 10000000 } } });
    expect(pub.data.id).toBe('refund_sky_v2');
    const newB = await newBooking(U.sky, [{ offerId: 'offer_001', brandId: 'brand_001_flex' }], 'tc061b');
    const w0 = (await call(wallet.GET, { as: U.skyA })).data;
    const c1 = await call(cc.POST, { as: U.sky, idem: 'tc061c', params: { id: oldB }, body: {} });
    expect(c1.data.agencyPayoutStatus).toBe('PENDING');
    const claim1 = db.select().from(s.refundClaims).where(eq(s.refundClaims.bookingId, oldB)).get()!;
    expect([claim1.refundPolicyId, claim1.refundPolicyVersion, claim1.payoutMode]).toEqual(['refund_sky_v1', 1, 'SUPPLIER_SETTLEMENT']);
    expect((await call(wallet.GET, { as: U.skyA })).data.walletCashMinor).toBe(w0.walletCashMinor);
    const c2 = await call(cc.POST, { as: U.sky, idem: 'tc061d', params: { id: newB }, body: {} });
    expect(c2.data.agencyPayoutStatus).toBe('CREDITED');
    const claim2 = db.select().from(s.refundClaims).where(eq(s.refundClaims.bookingId, newB)).get()!;
    expect([claim2.refundPolicyId, claim2.payoutMode]).toEqual(['refund_sky_v2', 'IMMEDIATE_IF_ELIGIBLE']);
    expect(db.select().from(s.refundClaims).where(eq(s.refundClaims.id, 'RFD1004')).get()!.refundPolicyVersion).toBe(1);
  });
  it('TC-060 return itinerary full cancellation: B S2 + B S2 single claim INR 49,732.50 (fixed clock)', async () => {
    const id = await newBooking(U.sky, [{ offerId: 'offer_005', brandId: 'brand_005_saver' }, { offerId: 'offer_008', brandId: 'brand_008_saver' }], 'tc060', 'ROUND_TRIP');
    const q = await call(cq.POST, { as: U.sky, params: { id }, body: {} });
    expect(q.data.segments.map((x: any) => x.slab)).toEqual(['S2', 'S2']);
    expect(q.data.estimatedAgencyRefundMinor).toBe(4973250);
    const c = await call(cc.POST, { as: U.sky, idem: 'tc060c', params: { id }, body: {} });
    expect(c.data.refundMinor).toBe(4973250);
    expect(db.select().from(s.refundClaims).where(eq(s.refundClaims.bookingId, id)).all()).toHaveLength(1);
  });
  it('TC-022 (service) boundary cancellation uses booked snapshot at exactly 24h / 2h', async () => {
    const id = await newBooking(U.sky, [{ offerId: 'offer_013', brandId: 'brand_013_flex' }], 'tc022');
    const dep = Date.parse(db.select().from(s.bookingSegments).where(eq(s.bookingSegments.bookingId, id)).get()!.departureAt);
    resetTokens(); setClockOverride(new Date(dep - 24 * 3600000).toISOString());
    expect((await call(cq.POST, { as: U.sky, params: { id }, body: {} })).data.segments[0].slab).toBe('S2');
    resetTokens(); setClockOverride(new Date(dep - 24 * 3600000 + 1000).toISOString());
    expect((await call(cq.POST, { as: U.sky, params: { id }, body: {} })).data.segments[0].slab).toBe('S1');
    resetTokens(); setClockOverride(new Date(dep - 2 * 3600000).toISOString());
    expect((await call(cq.POST, { as: U.sky, params: { id }, body: {} })).data.segments[0].slab).toBe('S1');
    resetTokens(); setClockOverride(new Date(dep - 2 * 3600000 + 1000).toISOString());
    const s0 = (await call(cq.POST, { as: U.sky, params: { id }, body: {} })).data;
    expect(s0.segments[0].slab).toBe('S0');
    expect(s0.estimatedAgencyRefundMinor).toBe(0);
    resetTokens(); setClockOverride(new Date(dep).toISOString());
    const ns = (await call(cq.POST, { as: U.sky, params: { id }, body: {} })).data;
    expect(ns.segments[0].slab).toBe('NO_SHOW');
    expect(ns.eligible).toBe(false);
    setClockOverride('2026-11-19T12:00:00.000Z'); resetTokens();
  });
});

describe('S-E offline PNR import', () => {
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('TC-041 SBD101 via SABRE/S9KY previews then imports once to Skyline, no ledger posting', async () => {
    const w0 = (await call(wallet.GET, { as: U.skyA })).data;
    const l = await call(lookup.POST, { as: U.sky, body: { provider: 'SABRE', pcc: 'S9KY', pnr: 'SBD101' } });
    expect(l.status).toBe(200);
    expect(l.data.ticketNumbers).toEqual(['098-2400801001']);
    const r = await call(imp.POST, { as: U.sky, idem: 'tc041', body: { provider: 'SABRE', pcc: 'S9KY', pnr: 'SBD101' } });
    expect(r.status).toBe(201);
    const d = (await call(bookingOne.GET, { as: U.sky, params: { id: r.data.bookingId } })).data;
    expect(d.source).toBe('IMPORTED');
    expect(d.agencyId).toBe('agency_skyline');
    expect(d.walletEntries).toHaveLength(0);
    expect((await call(wallet.GET, { as: U.skyA })).data.walletCashMinor).toBe(w0.walletCashMinor);
    const list = (await call(bookings.GET, { as: U.sky, url: '/api/v1/bookings?source=IMPORTED' })).data;
    expect(list.some((b: any) => b.id === r.data.bookingId)).toBe(true);
  });
  it('TC-042 repeat SBD101 and seeded SBD404 → PNR_ALREADY_IMPORTED; no duplicate', async () => {
    const r = await call(imp.POST, { as: U.sky, idem: 'tc042a', body: { provider: 'SABRE', pcc: 'S9KY', pnr: 'SBD101' } });
    expect(r.error.code).toBe('PNR_ALREADY_IMPORTED');
    expect((await call(imp.POST, { as: U.sky, idem: 'tc042b', body: { provider: 'SABRE', pcc: 'S9KY', pnr: 'SBD404' } })).error.code).toBe('PNR_ALREADY_IMPORTED');
    expect(db.select().from(s.pnrRecords).where(eq(s.pnrRecords.gdsPnr, 'SBD101')).all()).toHaveLength(1);
  });
  it('TC-043 unknown, wrong PCC, other tenant, unconnected provider → neutral rejection', async () => {
    const neg = [
      { as: U.orb, body: { provider: 'SABRE', pcc: 'O4RB', pnr: 'SBD101' } },
      { as: U.orb, body: { provider: 'SABRE', pcc: 'S9KY', pnr: 'SBD101' } },
      { as: U.sky, body: { provider: 'SABRE', pcc: 'H7FA', pnr: 'NOPE99' } },
      { as: U.sky, body: { provider: 'SABRE', pcc: 'H7FA', pnr: 'SBD303' } },
    ];
    for (const n of neg) {
      const r = await call(lookup.POST, n);
      expect(r.status).toBe(404);
      expect(r.error.code).toBe('PNR_NOT_FOUND');
      expect(JSON.stringify(r.json)).not.toContain('Kavya');
    }
    expect((await call(lookup.POST, { as: U.sky, body: { provider: 'TRAVELPORT', pcc: 'T1PA', pnr: 'SBD101' } })).error.code).toBe('INTEGRATION_NOT_CONNECTED');
    const hub = await call(imp.POST, { as: U.ops, idem: 'tc043-hub', body: { provider: 'SABRE', pcc: 'H7FA', pnr: 'SBD303', targetAgencyId: 'agency_orbit' } });
    expect(hub.status).toBe(201);
    const noTkt = await call(imp.POST, { as: U.astA, idem: 'tc043-505', body: { provider: 'SABRE', pcc: 'H7FA', pnr: 'SBD505' } });
    expect(noTkt.data.ticketStatus).toBe('PENDING');
  });
});
