import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, call, U, resetTokens } from '../helpers';
import * as s from '@/server/db/schema';
import * as cq from '@/app/api/v1/bookings/[id]/cancel-quote/route';
import * as cc from '@/app/api/v1/bookings/[id]/cancel-confirm/route';
import * as bookingOne from '@/app/api/v1/bookings/[id]/route';
import * as exec from '@/app/api/v1/executive/[view]/route';
import { kpisFor } from '@/features/executive/kpis';

let db: ReturnType<typeof freshDb>;

describe('P0-1 PNR split and partial cancellation', () => {
  beforeAll(() => { db = freshDb(); resetTokens(); });

  it('3-passenger booking HFB1026: quote for 1 of 3 passengers is per-passenger (A_FLEXIBLE S2)', async () => {
    const q = await call(cq.POST, { as: U.sky, params: { id: 'HFB1026' }, body: { mode: 'CANCEL', passengerIds: ['HFB1026_pax2'] } });
    expect(q.status).toBe(200);
    expect(q.data.eligible).toBe(true);
    expect(q.data.partial.totalPassengers).toBe(3);
    expect(q.data.partial.selectedPassengers.map((p: any) => p.name)).toEqual(['Ms Pooja Khanna']);
    expect(q.data.agencyAmountPaidMinor).toBe(1620000); // one passenger's share
    expect(q.data.supplierPenaltyMinor).toBe(104700);   // A_FLEXIBLE S2, one adult
    expect(q.data.serviceFeeMinor).toBe(5000);
    expect(q.data.estimatedAgencyRefundMinor).toBe(1620000 - 104700 - 5000);
  });

  it('confirm splits the PNR: cancelled passenger moves to child PNR; others stay ticketed on original', async () => {
    const r = await call(cc.POST, { as: U.sky, idem: 'split-1', params: { id: 'HFB1026' }, body: { mode: 'CANCEL', passengerIds: ['HFB1026_pax2'] } });
    expect(r.status).toBe(200);
    expect(r.data.partial).toBe(true);
    expect(r.data.childBookingId).toBe('HFB1026-S1');
    expect(r.data.childPnr).toMatch(/^SBS\d{3}$/);
    expect(r.data.parentPnr).toBe('SBX026');
    expect(r.data.refundMinor).toBe(1510300);
    const parent = db.select().from(s.bookings).where(eq(s.bookings.id, 'HFB1026')).get()!;
    const child = db.select().from(s.bookings).where(eq(s.bookings.id, 'HFB1026-S1')).get()!;
    expect(parent.bookingStatus).toBe('TICKETED');
    expect(parent.sellAmountMinor).toBe(3240000);
    expect(child.bookingStatus).toBe('CANCELLED');
    expect(child.sellAmountMinor).toBe(1620000);
    expect(child.parentBookingId).toBe('HFB1026');
    expect(db.select().from(s.passengers).where(eq(s.passengers.bookingId, 'HFB1026')).all().map((p) => p.displayName)).toEqual(['Mr Amit Khanna', 'Mr Kunal Khanna']);
    const childTix = db.select().from(s.tickets).where(eq(s.tickets.bookingId, 'HFB1026-S1')).all();
    expect(childTix).toHaveLength(1); expect(childTix[0].status).toBe('CANCELLED');
    expect(db.select().from(s.tickets).where(eq(s.tickets.bookingId, 'HFB1026')).all().every((t) => t.status === 'ISSUED')).toBe(true);
    const claim = db.select().from(s.refundClaims).where(eq(s.refundClaims.bookingId, 'HFB1026-S1')).get()!;
    expect(claim.payoutMode).toBe('SUPPLIER_SETTLEMENT');
    expect(claim.agencyPayoutStatus).toBe('PENDING');
    expect(claim.supplierStatus).toBe('PENDING');
  });

  it('booking detail shows split history on both records; replay returns the same result', async () => {
    const p = (await call(bookingOne.GET, { as: U.sky, params: { id: 'HFB1026' } })).data;
    expect(p.splitChildren.map((c: any) => c.bookingId)).toEqual(['HFB1026-S1']);
    expect(p.passengers).toHaveLength(2);
    expect(p.history.some((h: any) => h.action === 'PNR_SPLIT')).toBe(true);
    const c = (await call(bookingOne.GET, { as: U.sky, params: { id: 'HFB1026-S1' } })).data;
    expect(c.parentBookingId).toBe('HFB1026');
    const again = await call(cc.POST, { as: U.sky, idem: 'split-1', params: { id: 'HFB1026' }, body: { mode: 'CANCEL', passengerIds: ['HFB1026_pax2'] } });
    expect(again.data.childBookingId).toBe('HFB1026-S1');
    expect(db.select().from(s.bookings).where(eq(s.bookings.parentBookingId, 'HFB1026')).all()).toHaveLength(1);
  });

  it('GBV is conserved by the split; the cancellation is reflected in KPIs', async () => {
    const k = kpisFor(db, {});
    expect(k.grossBookingValueMinor).toBe(46120000);
    expect(k.cancelledCount).toBe(6);
    expect(k.agencyRefundObligationMinor).toBe(4585900 + 1510300);
    const c = (await call(exec.GET, { as: U.cxo, params: { view: 'cancellations' } })).data;
    expect(c.totals.cancelled).toBe(6);
  });

  it('second split on the remaining two passengers; then the last passenger can only be fully cancelled', async () => {
    const r = await call(cc.POST, { as: U.sky, idem: 'split-2', params: { id: 'HFB1026' }, body: { mode: 'CANCEL', passengerIds: ['HFB1026_pax1'] } });
    expect(r.data.childBookingId).toBe('HFB1026-S2');
    const last = await call(cq.POST, { as: U.sky, params: { id: 'HFB1026' }, body: { mode: 'CANCEL', passengerIds: ['HFB1026_pax3'] } });
    expect(last.data.partial).toBeUndefined(); // selecting the only remaining passenger = full cancellation
    expect(last.data.eligible).toBe(true);
  });

  it('Orbit immediate-refund policy: partial cancel credits the wallet once for the split passenger', async () => {
    const r = await call(cc.POST, { as: U.orbA, idem: 'split-orb', params: { id: 'HFB1027' }, body: { mode: 'CANCEL', passengerIds: ['HFB1027_pax2'] } });
    expect(r.status).toBe(200);
    expect(r.data.agencyPayoutStatus).toBe('CREDITED');
    expect(r.data.walletCreditedMinor).toBe(3820000 - 104700 - 5000);
    const credits = db.select().from(s.walletLedgerEntries).where(eq(s.walletLedgerEntries.bookingId, 'HFB1027-S1')).all();
    expect(credits).toHaveLength(1);
  });

  it('rejects foreign passengers, foreign agency and single-passenger selections that empty nothing', async () => {
    expect((await call(cq.POST, { as: U.sky, params: { id: 'HFB1025' }, body: { mode: 'CANCEL', passengerIds: ['HFB1027_pax1'] } })).status).toBe(422);
    expect((await call(cq.POST, { as: U.orb, params: { id: 'HFB1025' }, body: { mode: 'CANCEL', passengerIds: ['HFB1025_pax1'] } })).status).toBe(404);
    const v = await call(cq.POST, { as: U.sky, params: { id: 'HFB1025' }, body: { mode: 'VOID', passengerIds: ['HFB1025_pax1'] } });
    expect(v.data.eligible).toBe(false);
  });
});
