import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, call, U, resetTokens } from '../helpers';
import * as s from '@/server/db/schema';
import * as amend from '@/app/api/v1/amendments/route';
import * as amendQ from '@/app/api/v1/amendments/quote/route';
import * as bookingOne from '@/app/api/v1/bookings/[id]/route';
import * as wallet from '@/app/api/v1/wallet/route';
import * as cq from '@/app/api/v1/bookings/[id]/cancel-quote/route';
import { fareDifferenceBps } from '@/features/amendments/service';

let db: ReturnType<typeof freshDb>;
describe('P1-23/24 date change with ticket reissue', () => {
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('fare difference bands are deterministic', () => {
    expect([1, 5, 10, 20, 45].map(fareDifferenceBps)).toEqual([1500, 1000, 600, 250, 0]);
  });
  it('2-passenger A_FLEXIBLE booking: per-passenger change fee, fare difference and service fee', async () => {
    const q = await call(amendQ.POST, { as: U.sky, body: { bookingId: 'HFB1025', newDate: '2027-01-10' } });
    expect(q.data.permitted).toBe(true);
    expect(q.data.adults).toBe(2);
    expect(q.data.perPassenger.airlineChangeFeeMinor).toBe(150000); // A_FLEXIBLE date-change S2
    expect(q.data.breakdown.fareDifferenceMinor).toBe(0);            // > 30 days ahead
    expect(q.data.totalMinor).toBe(2 * 150000 + 2 * 5000);
  });
  it('confirm: wallet debited once, new date + new tickets, history records the reissue; replay is idempotent', async () => {
    const before = (await call(wallet.GET, { as: U.skyA })).data.walletCashMinor;
    const body = { bookingId: 'HFB1025', legIndex: 0, newDate: '2027-01-10', expectedTotalMinor: 310000 };
    const r = await call(amend.POST, { as: U.sky, idem: 'amd-1', body });
    expect(r.status).toBe(201);
    expect(r.data.newTickets).toHaveLength(2);
    expect(r.data.exchangedTickets).toEqual(['098-2410000025', '098-2410000125']);
    const again = await call(amend.POST, { as: U.sky, idem: 'amd-1', body });
    expect(again.data.amendmentId).toBe(r.data.amendmentId);
    expect((await call(wallet.GET, { as: U.skyA })).data.walletCashMinor).toBe(before - 310000);
    const d = (await call(bookingOne.GET, { as: U.sky, params: { id: 'HFB1025' } })).data;
    expect(d.segments[0].departureAt.slice(0, 10)).toBe('2027-01-10');
    expect(d.passengers.map((p: any) => p.ticketNumber)).toEqual(r.data.newTickets);
    expect(d.history.some((h: any) => h.action === 'TICKET_REISSUED')).toBe(true);
    expect(d.tickets.filter((t: any) => t.status === 'EXCHANGED')).toHaveLength(2);
  });
  it('stale expected total is rejected; same date / past / foreign booking are refused', async () => {
    expect((await call(amend.POST, { as: U.sky, idem: 'amd-2', body: { bookingId: 'HFB1001', newDate: '2026-12-20', expectedTotalMinor: 1 } })).status).toBe(409);
    expect((await call(amendQ.POST, { as: U.sky, body: { bookingId: 'HFB1025', newDate: '2027-01-10' } })).data.permitted).toBe(false);
    expect((await call(amendQ.POST, { as: U.sky, body: { bookingId: 'HFB1001', newDate: '2026-11-01' } })).data.permitted).toBe(false);
    expect((await call(amendQ.POST, { as: U.orb, body: { bookingId: 'HFB1001', newDate: '2026-12-20' } })).status).toBe(404);
  });
  it('cancellation after a reissue still cancels only the live tickets', async () => {
    const q = await call(cq.POST, { as: U.sky, params: { id: 'HFB1025' }, body: { mode: 'CANCEL', passengerIds: ['HFB1025_pax1'] } });
    expect(q.data.eligible).toBe(true);
    expect(db.select().from(s.tickets).where(eq(s.tickets.bookingId, 'HFB1025')).all()).toHaveLength(4);
  });
});
