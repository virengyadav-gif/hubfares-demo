import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, call, U, resetTokens } from '../helpers';
import * as s from '@/server/db/schema';
import * as search from '@/app/api/v1/pnr-imports/search/route';
import * as bulk from '@/app/api/v1/pnr-imports/bulk/route';
import * as bookingOne from '@/app/api/v1/bookings/[id]/route';

let db: ReturnType<typeof freshDb>;
describe('P1-25 Import PNR — optional filters and bulk import', () => {
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('no filters → every PNR the OTA may import (own agency only); provider identity hidden', async () => {
    const r = await call(search.POST, { as: U.sky, body: {} });
    expect(r.status).toBe(200);
    expect(r.data.map((x: any) => x.gdsPnr).sort()).toEqual(['SBD101', 'SBD111', 'SBD112', 'SBD113', 'SBD404']);
    expect(r.data.every((x: any) => x.provider === undefined)).toBe(true);
    expect(r.data.find((x: any) => x.gdsPnr === 'SBD404').alreadyImported).toBe(true);
  });
  it('PCC only / PNR only / passenger / date range narrow the list', async () => {
    expect((await call(search.POST, { as: U.sky, body: { pcc: 'S9KY' } })).data).toHaveLength(5);
    expect((await call(search.POST, { as: U.sky, body: { pnr: 'SBD11' } })).data.map((x: any) => x.gdsPnr).sort()).toEqual(['SBD111', 'SBD112', 'SBD113']);
    expect((await call(search.POST, { as: U.sky, body: { passenger: 'menon' } })).data.map((x: any) => x.gdsPnr)).toEqual(['SBD113']);
    expect((await call(search.POST, { as: U.sky, body: { from: '2026-11-24', to: '2026-11-30' } })).data.map((x: any) => x.gdsPnr).sort()).toEqual(['SBD101', 'SBD112']);
    expect((await call(search.POST, { as: U.sky, body: { pcc: 'O4RB' } })).data).toHaveLength(0); // other agency's PCC
  });
  it('bulk import creates one booking per new PNR, skips already-imported ones, and is idempotent', async () => {
    const items = ['SBD101', 'SBD111', 'SBD113', 'SBD404'].map((pnr) => ({ pcc: 'S9KY', pnr }));
    const r = await call(bulk.POST, { as: U.sky, idem: 'bulk-1', body: { items } });
    expect(r.status).toBe(200);
    expect(r.data.map((x: any) => x.status)).toEqual(['IMPORTED', 'IMPORTED', 'IMPORTED', 'ALREADY_IMPORTED']);
    const again = await call(bulk.POST, { as: U.sky, idem: 'bulk-1', body: { items } });
    expect(again.data.map((x: any) => x.bookingId)).toEqual(r.data.map((x: any) => x.bookingId));
    const trio = r.data[2].bookingId;
    const d = (await call(bookingOne.GET, { as: U.sky, params: { id: trio } })).data;
    expect(d.source).toBe('IMPORTED'); expect(d.passengers).toHaveLength(3); expect(d.bookingStatus).toBe('TICKETED');
    expect(db.select().from(s.walletLedgerEntries).where(eq(s.walletLedgerEntries.bookingId, trio)).all()).toHaveLength(0);
    expect((await call(search.POST, { as: U.sky, body: {} })).data.filter((x: any) => !x.alreadyImported).map((x: any) => x.gdsPnr)).toEqual(['SBD112']);
  });
  it('Operations sees all agencies with owner; importing another agency PNR as OTA fails neutrally', async () => {
    const ops = await call(search.POST, { as: U.ops, body: {} });
    expect(ops.data.length).toBeGreaterThanOrEqual(10);
    expect(ops.data.find((x: any) => x.gdsPnr === 'SBD313').ownerAgencyName).toBe('Aster Holidays');
    const r = await call(bulk.POST, { as: U.sky, idem: 'bulk-2', body: { items: [{ pcc: 'O4RB', pnr: 'SBD212' }] } });
    expect(r.data[0].status).toBe('FAILED');
    const h = await call(bulk.POST, { as: U.ops, idem: 'bulk-3', body: { items: [{ pcc: 'O4RB', pnr: 'SBD212' }] } });
    expect(h.data[0].status).toBe('IMPORTED');
    expect(db.select().from(s.bookings).where(eq(s.bookings.id, h.data[0].bookingId)).get()!.agencyId).toBe('agency_orbit');
  });
});
