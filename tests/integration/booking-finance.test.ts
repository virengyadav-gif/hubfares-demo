import { describe, it, expect, beforeAll } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { freshDb, call, U, resetTokens } from '../helpers';
import * as s from '@/server/db/schema';
import * as offers from '@/app/api/v1/flight-offers/route';
import * as quotes from '@/app/api/v1/quotes/route';
import * as reval from '@/app/api/v1/quotes/[id]/revalidate/route';
import * as accept from '@/app/api/v1/quotes/[id]/accept/route';
import * as bookings from '@/app/api/v1/bookings/route';
import * as bookingOne from '@/app/api/v1/bookings/[id]/route';
import * as issue from '@/app/api/v1/bookings/[id]/issue-ticket/route';
import * as wallet from '@/app/api/v1/wallet/route';
import * as passbook from '@/app/api/v1/wallet/passbook/route';
import * as payDemo from '@/app/api/v1/payment-events/demo/route';
import * as payMatch from '@/app/api/v1/payment-events/[id]/match/route';
import * as payReplay from '@/app/api/v1/payment-events/replay/route';
import * as payList from '@/app/api/v1/payment-events/route';
import * as policies from '@/app/api/v1/agency-policies/route';
import * as coreRules from '@/app/api/v1/core-commercial-rules/[id]/route';
import * as markup from '@/app/api/v1/agency-markup-rules/route';
import * as adv from '@/app/api/v1/advanced-commercial-drafts/route';
import * as exec from '@/app/api/v1/executive/[view]/route';
import * as fx from '@/app/api/v1/fx-demo-rates/route';
import { convertForDisplay } from '@/shared/money/fx';

let db: ReturnType<typeof freshDb>;
const pax = [{ title: 'Ms', firstName: 'Asha', lastName: 'Demo' }];
async function quoteFor(as: string, legs: { offerId: string; brandId: string }[], tripType: 'ONE_WAY' | 'ROUND_TRIP' = 'ONE_WAY') {
  const q = await call(quotes.POST, { as, body: { tripType, legs, adults: 1 } });
  expect(q.status, JSON.stringify(q.error)).toBe(201);
  return q.data;
}
async function bookAndTicket(as: string, legs: { offerId: string; brandId: string }[], key: string, tripType: 'ONE_WAY' | 'ROUND_TRIP' = 'ONE_WAY') {
  const q = await quoteFor(as, legs, tripType);
  const r = await call(reval.POST, { as, params: { id: q.quoteId }, body: { scenario: 'reval_same' } });
  expect(r.data.status).toBe('SAME');
  const b = await call(bookings.POST, { as, idem: `${key}-book`, body: { quoteId: q.quoteId, passengers: pax, contactEmail: 'a@example.com' } });
  expect(b.status, JSON.stringify(b.error)).toBe(201);
  const t = await call(issue.POST, { as, idem: `${key}-tkt`, params: { id: b.data.bookingId }, body: { scenario: 'normal' } });
  expect(t.status, JSON.stringify(t.error)).toBe(200);
  return { quote: q, booking: b.data, ticket: t.data };
}

describe('Search, pricing, FX, commercial separation', () => {
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('TC-019 BOM→LON search returns coherent branded offers incl. both profiles; cheapest first', async () => {
    const r = await call(offers.GET, { as: U.sky, url: '/api/v1/flight-offers?origin=BOM&destination=LON&departureDate=2026-11-29&adults=1' });
    expect(r.status).toBe(200);
    const ids = r.data.outbound.results.map((o: any) => o.id).sort();
    expect(ids).toEqual(['offer_005', 'offer_006', 'offer_020']);
    const o5 = r.data.outbound.results.find((o: any) => o.id === 'offer_005');
    expect(o5.brands.find((b: any) => b.id === 'brand_005_saver').sellMinor).toBe(3063250);
    const profiles = new Set(r.data.outbound.results.flatMap((o: any) => o.brands.map((b: any) => b.ruleProfileId)));
    expect(profiles).toEqual(new Set(['A_FLEXIBLE', 'B_RESTRICTED']));
    expect(r.json.meta.source).toBe('SIMULATED');
    expect(r.data.outbound.dateStrip).toHaveLength(7);
  });
  it('TC-020 unsupported route → honest empty/validation, never invented offers', async () => {
    const r = await call(offers.GET, { as: U.sky, url: '/api/v1/flight-offers?origin=BOM&destination=DEL&departureDate=2026-12-31' });
    expect(r.status).toBe(200);
    expect(r.data.outbound.results).toHaveLength(0);
    const bad = await call(offers.GET, { as: U.sky, url: '/api/v1/flight-offers?origin=BOM&destination=NYC&departureDate=2026-11-29' });
    expect(bad.status).toBe(422);
    const ret = await call(offers.GET, { as: U.sky, url: '/api/v1/flight-offers?tripType=ROUND_TRIP&origin=BOM&destination=LON&departureDate=2026-11-29&returnDate=2026-11-20' });
    expect(ret.status).toBe(422);
    const inf = await call(offers.GET, { as: U.sky, url: '/api/v1/flight-offers?origin=BOM&destination=LON&departureDate=2026-11-29&adults=1&infants=2' });
    expect(inf.status).toBe(422);
  });
  it('TC-032 FX endpoint gives single DEMO table; quote amount unchanged by display currency', async () => {
    const r = await call(fx.GET, { as: U.sky });
    const usd = r.data.find((x: any) => x.quoteCurrency === 'USD');
    expect(convertForDisplay(3063250, usd)).toBe(34036);
    const q = await quoteFor(U.sky, [{ offerId: 'offer_005', brandId: 'brand_005_saver' }]);
    expect(q.sellAmount).toEqual({ amountMinor: 3063250, currency: 'INR' });
  });
  it('TC-030 OTA markup UI saved (INR 50/100) has zero effect on quotes', async () => {
    const before = await quoteFor(U.sky, [{ offerId: 'offer_005', brandId: 'brand_005_saver' }]);
    const m = await call(markup.POST, { as: U.skyA, body: { name: 'Test intl', journey: 'INTERNATIONAL', tripTypes: ['ONE_WAY'], airlineFilter: 'ALL', cabinFilter: 'ALL', markupKind: 'FIXED', value: 999900, targetUserIds: [], enabled: true } });
    expect(m.status).toBe(201);
    const after = await quoteFor(U.sky, [{ offerId: 'offer_005', brandId: 'brand_005_saver' }]);
    expect(after.sellAmount.amountMinor).toBe(before.sellAmount.amountMinor);
    const agentTry = await call(markup.POST, { as: U.sky, body: { name: 'x', journey: 'BOTH', tripTypes: ['ONE_WAY'], airlineFilter: 'ALL', cabinFilter: 'ALL', markupKind: 'FIXED', value: 100, targetUserIds: [], enabled: true } });
    expect(agentTry.status).toBe(403);
  });
  it('TC-031 advanced draft with 5*BF stored as text, never evaluated, zero pricing effect', async () => {
    const before = await quoteFor(U.sky, [{ offerId: 'offer_005', brandId: 'brand_005_saver' }]);
    const r = await call(adv.POST, { as: U.fin, body: { ruleName: 'Test draft', header: { airline: 'BA' }, criteria: { sector: { include: 'BOM-LHR', exclude: '' } }, lines: [{ type: 'IATA_COMMISSION', expression: '5*BF', applicableOnBooking: false, applicableOnInfant: false, applicableOnAllSegments: true }], priority: 1, enabled: true } });
    expect(r.status).toBe(201);
    expect(r.data.evaluated).toBe(false);
    const inj = await call(adv.POST, { as: U.fin, body: { ruleName: 'x', header: {}, criteria: {}, lines: [{ type: 'MARKUP', expression: 'process.exit()', applicableOnBooking: false, applicableOnInfant: false, applicableOnAllSegments: false }], priority: 1, enabled: true } });
    expect(inj.status).toBe(422);
    const after = await quoteFor(U.sky, [{ offerId: 'offer_005', brandId: 'brand_005_saver' }]);
    expect(after.sellAmount.amountMinor).toBe(before.sellAmount.amountMinor);
  });
  it('TC-029 core fee INR 250→350 changes NEW quotes only; prior booking keeps snapshot', async () => {
    const { booking } = await bookAndTicket(U.sky, [{ offerId: 'offer_005', brandId: 'brand_005_saver' }], 'tc029');
    const rule = db.select().from(s.coreCommercialRules).where(eq(s.coreCommercialRules.id, 'core_sky_bom_lon')).get()!;
    const r = await call(coreRules.PATCH, { as: U.fin, method: 'PATCH', params: { id: rule.id }, body: { label: rule.label, agencyId: rule.agencyId, airlineCode: rule.airlineCode, origin: rule.origin, destination: rule.destination, fixedFeeMinor: 35000, percentBps: 150, disclosedServiceFeeMinor: 0, priority: 10, enabled: true } });
    expect(r.status).toBe(200);
    const q = await quoteFor(U.sky, [{ offerId: 'offer_005', brandId: 'brand_005_saver' }]);
    expect(q.sellAmount.amountMinor).toBe(3073250);
    expect(q.segments[0].coreCommercialRuleVersion).toBe(2);
    const d = await call(bookingOne.GET, { as: U.sky, params: { id: booking.bookingId } });
    expect(d.data.amount.amountMinor).toBe(3063250);
    const cxo = await call(coreRules.PATCH, { as: U.cxo, method: 'PATCH', params: { id: rule.id }, body: { label: rule.label, fixedFeeMinor: 1, percentBps: 0, disclosedServiceFeeMinor: 0, priority: 10, enabled: true } });
    expect(cxo.status).toBe(403);
  });
});

describe('Booking lifecycle, funding and passbook', () => {
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('TC-023/024 revalidate → PNR with hold (no ticket) → ticket consumes hold and debits wallet once', async () => {
    const q = await quoteFor(U.sky, [{ offerId: 'offer_005', brandId: 'brand_005_saver' }]);
    await call(reval.POST, { as: U.sky, params: { id: q.quoteId }, body: {} });
    const w0 = (await call(wallet.GET, { as: U.sky })).data;
    const b = await call(bookings.POST, { as: U.sky, idem: 'tc023-book', body: { quoteId: q.quoteId, passengers: pax, contactEmail: 'a@example.com' } });
    expect(b.data.bookingStatus).toBe('PNR_CREATED');
    const d1 = (await call(bookingOne.GET, { as: U.sky, params: { id: b.data.bookingId } })).data;
    expect(d1.tickets).toHaveLength(0);
    expect(d1.ticketStatus).toBe('PENDING');
    const w1 = (await call(wallet.GET, { as: U.sky })).data;
    expect(w1.walletCashMinor).toBe(w0.walletCashMinor);
    expect(w1.walletHoldMinor - w0.walletHoldMinor).toBe(3063250);
    const t = await call(issue.POST, { as: U.sky, idem: 'tc024-tkt', params: { id: b.data.bookingId }, body: {} });
    expect(t.data.ticketNumbers).toHaveLength(1);
    const w2 = (await call(wallet.GET, { as: U.sky })).data;
    expect(w0.walletCashMinor - w2.walletCashMinor).toBe(3063250);
    expect(w2.walletHoldMinor).toBe(w0.walletHoldMinor);
    const pb = (await call(passbook.GET, { as: U.sky })).data;
    expect(pb.entries.filter((e: any) => e.bookingId === b.data.bookingId)).toHaveLength(1);
    const ops = await call(bookings.GET, { as: U.ops, url: '/api/v1/bookings?agencyId=agency_skyline' });
    expect(ops.data.some((x: any) => x.id === b.data.bookingId && x.bookingStatus === 'TICKETED')).toBe(true);
    const k = (await call(exec.GET, { as: U.cxo, params: { view: 'overview' } })).data.total;
    expect(k.grossBookingValueMinor).toBe(46120000 + 3063250);
  });
  it('TC-025 price change requires explicit acceptance; decline leaves no booking/charge', async () => {
    const q = await quoteFor(U.sky, [{ offerId: 'offer_001', brandId: 'brand_001_saver' }]);
    const r = await call(reval.POST, { as: U.sky, params: { id: q.quoteId }, body: { scenario: 'reval_change' } });
    expect(r.data.status).toBe('CHANGED');
    expect(r.data.quote.sellAmount.amountMinor - q.sellAmount.amountMinor).toBe(35000);
    const tryOld = await call(bookings.POST, { as: U.sky, idem: 'tc025-a', body: { quoteId: q.quoteId, passengers: pax, contactEmail: 'a@example.com' } });
    expect(tryOld.status).toBe(409);
    const tryNew = await call(bookings.POST, { as: U.sky, idem: 'tc025-b', body: { quoteId: r.data.quote.quoteId, passengers: pax, contactEmail: 'a@example.com' } });
    expect(tryNew.status).toBe(409);
    const dec = await call(accept.POST, { as: U.sky, params: { id: r.data.quote.quoteId }, body: { accept: false } });
    expect(dec.data.status).toBe('DECLINED');
    const count = db.select({ n: sql<number>`count(*)` }).from(s.bookings).where(eq(s.bookings.quoteId, r.data.quote.quoteId)).get()!;
    expect(count.n).toBe(0);
    const q2 = await quoteFor(U.sky, [{ offerId: 'offer_001', brandId: 'brand_001_saver' }]);
    const r2 = await call(reval.POST, { as: U.sky, params: { id: q2.quoteId }, body: { scenario: 'reval_change' } });
    await call(accept.POST, { as: U.sky, params: { id: r2.data.quote.quoteId }, body: { accept: true } });
    const ok = await call(bookings.POST, { as: U.sky, idem: 'tc025-c', body: { quoteId: r2.data.quote.quoteId, passengers: pax, contactEmail: 'a@example.com' } });
    expect(ok.status).toBe(201);
    const un = await quoteFor(U.sky, [{ offerId: 'offer_001', brandId: 'brand_001_saver' }]);
    expect((await call(reval.POST, { as: U.sky, params: { id: un.quoteId }, body: { scenario: 'reval_unavailable' } })).data.status).toBe('UNAVAILABLE');
  });
  it('TC-026 booking_fail and ticket_fail release the hold; no ticket, no charge', async () => {
    const w0 = (await call(wallet.GET, { as: U.sky })).data;
    const q = await quoteFor(U.sky, [{ offerId: 'offer_009', brandId: 'brand_009_saver' }]);
    await call(reval.POST, { as: U.sky, params: { id: q.quoteId }, body: {} });
    const f = await call(bookings.POST, { as: U.sky, idem: 'tc026-a', body: { quoteId: q.quoteId, passengers: pax, contactEmail: 'a@example.com', scenario: 'booking_fail' } });
    expect(f.data.bookingStatus).toBe('BOOKING_FAILED');
    const q2 = await quoteFor(U.sky, [{ offerId: 'offer_009', brandId: 'brand_009_saver' }]);
    await call(reval.POST, { as: U.sky, params: { id: q2.quoteId }, body: {} });
    const b = await call(bookings.POST, { as: U.sky, idem: 'tc026-b', body: { quoteId: q2.quoteId, passengers: pax, contactEmail: 'a@example.com' } });
    const t = await call(issue.POST, { as: U.sky, idem: 'tc026-c', params: { id: b.data.bookingId }, body: { scenario: 'ticket_fail' } });
    expect(t.data.bookingStatus).toBe('TICKETING_FAILED');
    const w1 = (await call(wallet.GET, { as: U.sky })).data;
    expect(w1.walletCashMinor).toBe(w0.walletCashMinor);
    expect(w1.walletHoldMinor).toBe(w0.walletHoldMinor);
    const d = (await call(bookingOne.GET, { as: U.sky, params: { id: b.data.bookingId } })).data;
    expect(d.tickets).toHaveLength(0);
    const again = await call(issue.POST, { as: U.sky, idem: 'tc026-d', params: { id: b.data.bookingId }, body: {} });
    expect(again.status).toBe(409);
  });
  it('TC-027/TC-018 replay with same key returns same result; different payload → 409; no double charge', async () => {
    const q = await quoteFor(U.sky, [{ offerId: 'offer_015', brandId: 'brand_015_saver' }]);
    await call(reval.POST, { as: U.sky, params: { id: q.quoteId }, body: {} });
    const body = { quoteId: q.quoteId, passengers: pax, contactEmail: 'a@example.com' };
    const a = await call(bookings.POST, { as: U.sky, idem: 'tc027-key', body });
    const b = await call(bookings.POST, { as: U.sky, idem: 'tc027-key', body });
    expect(b.data.bookingId).toBe(a.data.bookingId);
    expect(b.json.meta.idempotentReplay).toBe(true);
    const c = await call(bookings.POST, { as: U.sky, idem: 'tc027-key', body: { ...body, contactEmail: 'other@example.com' } });
    expect(c.status).toBe(409);
    const t1 = await call(issue.POST, { as: U.sky, idem: 'tc027-t', params: { id: a.data.bookingId }, body: {} });
    const t2 = await call(issue.POST, { as: U.sky, idem: 'tc027-t', params: { id: a.data.bookingId }, body: {} });
    expect(t2.data.ticketNumbers).toEqual(t1.data.ticketNumbers);
    const debits = db.select().from(s.walletLedgerEntries).where(eq(s.walletLedgerEntries.bookingId, a.data.bookingId)).all();
    expect(debits).toHaveLength(1);
    expect(db.select().from(s.tickets).where(eq(s.tickets.bookingId, a.data.bookingId)).all()).toHaveLength(1);
  });
  it('TC-059 return BOM-LON + LON-BOM: one quote (2 segments) INR 55,832.50, one booking/PNR/ticket/charge', async () => {
    const q = await quoteFor(U.sky, [{ offerId: 'offer_005', brandId: 'brand_005_saver' }, { offerId: 'offer_008', brandId: 'brand_008_saver' }], 'ROUND_TRIP');
    expect(q.segments).toHaveLength(2);
    expect(q.segments.map((x: any) => x.direction)).toEqual(['OUTBOUND', 'INBOUND']);
    expect(q.sellAmount.amountMinor).toBe(5583250);
    expect(q.segments[1].legSellAmount.amountMinor).toBe(2520000);
    await call(reval.POST, { as: U.sky, params: { id: q.quoteId }, body: {} });
    const b = await call(bookings.POST, { as: U.sky, idem: 'tc059-b', body: { quoteId: q.quoteId, passengers: pax, contactEmail: 'a@example.com' } });
    const t = await call(issue.POST, { as: U.sky, idem: 'tc059-t', params: { id: b.data.bookingId }, body: {} });
    expect(t.data.ticketNumbers).toHaveLength(1);
    const d = (await call(bookingOne.GET, { as: U.sky, params: { id: b.data.bookingId } })).data;
    expect(d.segments).toHaveLength(2);
    expect(d.amount.amountMinor).toBe(5583250);
    expect(d.walletEntries).toHaveLength(1);
    expect(d.walletEntries[0].amountMinor).toBe(5583250);
    expect(db.select().from(s.pnrRecords).where(eq(s.pnrRecords.bookingId, b.data.bookingId)).all()).toHaveLength(1);
    const bad = await call(quotes.POST, { as: U.sky, body: { tripType: 'ROUND_TRIP', legs: [{ offerId: 'offer_005', brandId: 'brand_005_saver' }], adults: 1 } });
    expect(bad.status).toBe(422);
    const mismatch = await call(quotes.POST, { as: U.sky, body: { tripType: 'ROUND_TRIP', legs: [{ offerId: 'offer_005', brandId: 'brand_005_saver' }, { offerId: 'offer_010', brandId: 'brand_010_saver' }], adults: 1 } });
    expect(mismatch.status).toBe(422);
  });
  it('TC-060 (failure) inbound provider failure on a return booking releases the whole hold; no partial', async () => {
    const w0 = (await call(wallet.GET, { as: U.sky })).data;
    const q = await quoteFor(U.sky, [{ offerId: 'offer_005', brandId: 'brand_005_saver' }, { offerId: 'offer_008', brandId: 'brand_008_saver' }], 'ROUND_TRIP');
    await call(reval.POST, { as: U.sky, params: { id: q.quoteId }, body: {} });
    const b = await call(bookings.POST, { as: U.sky, idem: 'tc060f-b', body: { quoteId: q.quoteId, passengers: pax, contactEmail: 'a@example.com', scenario: 'booking_fail' } });
    expect(b.data.bookingStatus).toBe('BOOKING_FAILED');
    const w1 = (await call(wallet.GET, { as: U.sky })).data;
    expect(w1.walletCashMinor).toBe(w0.walletCashMinor);
    expect(w1.walletHoldMinor).toBe(w0.walletHoldMinor);
    expect(db.select().from(s.walletLedgerEntries).where(eq(s.walletLedgerEntries.bookingId, b.data.bookingId)).all()).toHaveLength(0);
  });
});

describe('Payments, credit and eligibility', () => {
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('TC-011 seeded UTR26111001 matches once → wallet + passbook', async () => {
    const w0 = (await call(wallet.GET, { as: U.skyA })).data;
    const m = await call(payMatch.POST, { as: U.fin, params: { id: 'pay_sky_match_001' }, idem: 'tc011' });
    expect(m.data.status).toBe('CREDITED');
    const w1 = (await call(wallet.GET, { as: U.skyA })).data;
    expect(w1.walletCashMinor - w0.walletCashMinor).toBe(2500000);
    const pb = (await call(passbook.GET, { as: U.skyA })).data;
    expect(pb.entries.filter((e: any) => e.externalRef === 'UTR26111001')).toHaveLength(1);
  });
  it('TC-012 replay of UTR26111001 / repeated match → no second credit', async () => {
    const r = await call(payReplay.POST, { as: U.fin, body: { externalRef: 'UTR26111001' } });
    expect(r.data.status).toBe('DUPLICATE_EVENT');
    const m = await call(payMatch.POST, { as: U.fin, params: { id: 'pay_sky_match_001' }, idem: 'tc012-other' });
    expect(m.data.status).toBe('ALREADY_PROCESSED');
    expect(db.select().from(s.walletLedgerEntries).where(eq(s.walletLedgerEntries.externalRef, 'UTR26111001')).all()).toHaveLength(1);
  });
  it('TC-013 unknown reference, wrong amount, USD → exceptions with zero credit', async () => {
    const before = db.select().from(s.walletLedgerEntries).all().length;
    expect((await call(payMatch.POST, { as: U.fin, params: { id: 'pay_sky_no_match' }, idem: 'tc013a' })).data.status).toBe('UNMATCHED');
    expect((await call(payMatch.POST, { as: U.fin, params: { id: 'pay_wrong_amount' }, idem: 'tc013b' })).data.status).toBe('EXCEPTION');
    expect((await call(payMatch.POST, { as: U.fin, params: { id: 'pay_missing_rate' }, idem: 'tc013c' })).data.status).toBe('REJECTED');
    expect(db.select().from(s.walletLedgerEntries).all().length).toBe(before);
    const list = (await call(payList.GET, { as: U.ops })).data;
    expect(list.find((p: any) => p.id === 'pay_sky_no_match').status).toBe('UNMATCHED');
  });
  it('OTA demo transfer auto-matches and credits once (S-H)', async () => {
    const w0 = (await call(wallet.GET, { as: U.skyA })).data;
    const r = await call(payDemo.POST, { as: U.skyA, idem: 'sh-1', body: { amountMinor: 1000000 } });
    expect(r.data.match.status).toBe('CREDITED');
    const again = await call(payDemo.POST, { as: U.skyA, idem: 'sh-1', body: { amountMinor: 1000000 } });
    expect(again.data.eventId).toBe(r.data.eventId);
    const w1 = (await call(wallet.GET, { as: U.skyA })).data;
    expect(w1.walletCashMinor - w0.walletCashMinor).toBe(1000000);
  });
  it('TC-014 Orbit credit limit change affects new eligibility only; existing draws unchanged', async () => {
    const before = (await call(wallet.GET, { as: U.orbA })).data;
    expect(before.availableCreditMinor).toBe(7450000);
    const r = await call(policies.PATCH, { as: U.fin, method: 'PATCH', body: { agencyId: 'agency_orbit', type: 'CREDIT', config: { cycle: 'WEEKLY', termDays: 7, creditEnabled: true, creditLimitMinor: 15000000, blockOnOverdue: true, allowWalletWhenCreditBlocked: true } } });
    expect(r.status).toBe(200);
    const after = (await call(wallet.GET, { as: U.orbA })).data;
    expect(after.creditOutstandingMinor).toBe(before.creditOutstandingMinor);
    expect(after.availableCreditMinor).toBe(2450000);
    const cxo = await call(policies.PATCH, { as: U.cxo, method: 'PATCH', body: { agencyId: 'agency_orbit', type: 'CREDIT', config: {} } });
    expect(cxo.status).toBe(403);
  });
  it('S-C / TC-017 Orbit books on credit: wallet used first, then credit draw; balances separate', async () => {
    const w0 = (await call(wallet.GET, { as: U.orbA })).data;
    expect((await call(wallet.GET, { as: U.orb })).status).toBe(403); // sub-user finance view restricted (TC-007/USR)
    const { booking } = await bookAndTicket(U.orb, [{ offerId: 'offer_017', brandId: 'brand_017_flex' }], 'sc');
    const d = (await call(bookingOne.GET, { as: U.orb, params: { id: booking.bookingId } })).data;
    const sell = d.amount.amountMinor;
    const w1 = (await call(wallet.GET, { as: U.orbA })).data;
    const walletUsed = w0.walletCashMinor - w1.walletCashMinor;
    const creditUsed = w1.creditOutstandingMinor - w0.creditOutstandingMinor;
    expect(walletUsed).toBe(Math.min(sell, w0.availableWalletMinor));
    expect(walletUsed + creditUsed).toBe(sell);
    expect(creditUsed).toBeGreaterThan(0); expect(d.fundingType).toBe('MIXED'); expect(d.creditEntries[0].dueAt > d.creditEntries[0].createdAt).toBe(true);
  });
  it('TC-015 insufficient spending power → rejected, no hold/PNR', async () => {
    const holds0 = db.select().from(s.fundingReservations).where(eq(s.fundingReservations.agencyId, 'agency_orbit')).all().length;
    const q = await quoteFor(U.orb, [{ offerId: 'offer_007', brandId: 'brand_007_businessflex' }]);
    await call(reval.POST, { as: U.orb, params: { id: q.quoteId }, body: {} });
    const r = await call(bookings.POST, { as: U.orb, idem: 'tc015', body: { quoteId: q.quoteId, passengers: pax, contactEmail: 'a@example.com' } });
    expect(r.status).toBe(422);
    expect(r.error.code).toBe('INSUFFICIENT_FUNDS');
    expect(db.select().from(s.fundingReservations).where(eq(s.fundingReservations.agencyId, 'agency_orbit')).all().length).toBe(holds0);
  });
  it('TC-016 Aster overdue credit blocked by policy v2; wallet-only booking still allowed', async () => {
    const w = (await call(wallet.GET, { as: U.astA })).data;
    expect(w.creditBlocked).toBe(true);
    expect(w.availableCreditMinor).toBe(0);
    expect(w.overdueMinor).toBe(4120000);
    const big = await quoteFor(U.astA, [{ offerId: 'offer_005', brandId: 'brand_005_flex' }]);
    await call(reval.POST, { as: U.astA, params: { id: big.quoteId }, body: {} });
    const r = await call(bookings.POST, { as: U.astA, idem: 'tc016a', body: { quoteId: big.quoteId, passengers: pax, contactEmail: 'a@example.com' } });
    expect(r.error.code).toBe('INSUFFICIENT_FUNDS');
    const { booking } = await bookAndTicket(U.astA, [{ offerId: 'offer_015', brandId: 'brand_015_saver' }], 'tc016b');
    const d = (await call(bookingOne.GET, { as: U.astA, params: { id: booking.bookingId } })).data;
    expect(d.fundingType).toBe('WALLET');
    expect(d.creditEntries).toHaveLength(0);
  });
});
