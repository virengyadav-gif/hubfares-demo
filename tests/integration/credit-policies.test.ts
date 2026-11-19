import { describe, it, expect, beforeAll } from 'vitest';
import { freshDb, call, U, resetTokens, ANCHOR } from '../helpers';
import * as wallet from '@/app/api/v1/wallet/route';
import * as quotes from '@/app/api/v1/quotes/route';
import * as reval from '@/app/api/v1/quotes/[id]/revalidate/route';
import * as bookings from '@/app/api/v1/bookings/route';
import * as issue from '@/app/api/v1/bookings/[id]/issue-ticket/route';
import * as repay from '@/app/api/v1/credit-repayments/route';
import { setClockOverride, isoPlus, DAY } from '@/shared/time';

async function book(as: string, offerId: string, brandId: string, key: string) {
  const q = await call(quotes.POST, { as, body: { tripType: 'ONE_WAY', legs: [{ offerId, brandId }], adults: 1 } });
  await call(reval.POST, { as, params: { id: q.data.quoteId }, body: {} });
  const b = await call(bookings.POST, { as, idem: `${key}-b`, body: { quoteId: q.data.quoteId, passengers: [{ title: 'Ms', firstName: 'Test', lastName: 'Traveller' }], contactEmail: 't@example.com' } });
  if (b.status !== 201) return b;
  return call(issue.POST, { as, idem: `${key}-t`, params: { id: b.data.bookingId }, body: {} });
}
describe('P1-32 prepaid, daily and weekly credit policies — limits, utilisation, overdue and automatic blocks', () => {
  beforeAll(() => { freshDb(); resetTokens(); });
  it('prepaid (Skyline): no credit facility; spending power = available wallet', async () => {
    const w = (await call(wallet.GET, { as: U.skyA })).data;
    expect(w.creditEnabled).toBe(false); expect(w.creditCycle).toBe('UPFRONT');
    expect(w.availableCreditMinor).toBe(0);
    expect(w.spendingPowerMinor).toBe(w.availableWalletMinor);
  });
  it('weekly (Orbit): utilisation = outstanding + holds; new draw is due 7 days after ticketing', async () => {
    const w = (await call(wallet.GET, { as: U.orbA })).data;
    expect(w.creditCycle).toBe('WEEKLY'); expect(w.creditTermDays).toBe(7);
    expect(w.creditLimitMinor - w.creditOutstandingMinor - w.creditHoldMinor).toBe(w.availableCreditMinor);
    expect(w.creditBlocked).toBe(false);
  });
  it('daily (Aster): overdue credit automatically blocks new credit; wallet-only booking still allowed', async () => {
    const w = (await call(wallet.GET, { as: U.astA })).data;
    expect(w.creditCycle).toBe('DAILY'); expect(w.overdueMinor).toBeGreaterThan(0);
    expect(w.creditBlocked).toBe(true); expect(w.availableCreditMinor).toBe(0);
    const t = await book(U.astA, 'offer_015', 'brand_015_saver', 'ast1');
    expect(t.status).toBe(200); // ₹3,550-ish fare fits in the wallet
  });
  it('repaying the overdue amount lifts the block; time passing past a weekly due date blocks again', async () => {
    const w = (await call(wallet.GET, { as: U.astA })).data;
    const r = await call(repay.POST, { as: U.fin, idem: 'rep1', body: { agencyId: 'agency_aster', amountMinor: w.overdueMinor, note: 'NEFT' } });
    expect(r.status).toBe(200);
    const after = (await call(wallet.GET, { as: U.astA })).data;
    expect(after.overdueMinor).toBe(0); expect(after.creditBlocked).toBe(false); expect(after.availableCreditMinor).toBeGreaterThan(0);
    // Orbit: move the clock 8 days ahead — every existing weekly draw is now past due → blocked.
    setClockOverride(isoPlus(ANCHOR, 8 * DAY)); resetTokens();
    const late = (await call(wallet.GET, { as: U.orbA })).data;
    expect(late.overdueMinor).toBeGreaterThan(0); expect(late.creditBlocked).toBe(true); expect(late.availableCreditMinor).toBe(0);
    setClockOverride(ANCHOR); resetTokens();
  });
});
