import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { eq } from 'drizzle-orm';
import { freshDb, call, U, PW, resetTokens } from '../helpers';
import * as s from '@/server/db/schema';
import * as login from '@/app/api/v1/auth/login/route';
import * as me from '@/app/api/v1/auth/me/route';
import * as apps from '@/app/api/v1/applications/route';
import * as appOne from '@/app/api/v1/applications/[id]/route';
import * as docs from '@/app/api/v1/applications/[id]/documents/route';
import * as submit from '@/app/api/v1/applications/[id]/submit/route';
import * as verify from '@/app/api/v1/applications/[id]/verify-demo/route';
import * as decision from '@/app/api/v1/applications/[id]/decision/route';
import * as opsApps from '@/app/api/v1/ops/applications/route';
import * as opsAppOne from '@/app/api/v1/ops/applications/[id]/route';
import * as users from '@/app/api/v1/agency-users/route';
import * as userOne from '@/app/api/v1/agency-users/[id]/route';
import * as bookingOne from '@/app/api/v1/bookings/[id]/route';
import * as bookings from '@/app/api/v1/bookings/route';
import * as claimOne from '@/app/api/v1/refund-claims/[id]/route';
import * as caseOne from '@/app/api/v1/support-cases/[id]/route';
import * as quotes from '@/app/api/v1/quotes/route';
import * as policies from '@/app/api/v1/agency-policies/route';
import * as reset from '@/app/api/v1/demo/reset/route';
import * as wallet from '@/app/api/v1/wallet/route';

let db: ReturnType<typeof freshDb>;
const draft = {
  organization: { agencyName: 'Bluebird Travels', turnoverInr: 25000000, entityType: 'PRIVATE_LIMITED', pan: 'AAKCB0777B', gstin: '27AAKCB0777B1Z1', registrationNumber: 'U63090MH2021PTC000777', website: '' },
  director: { salutation: 'Ms', firstName: 'Riya', lastName: 'Kulkarni', email: 'riya@bluebird.example.com', mobile: '+919000000777' },
  finance: { salutation: 'Mr', firstName: 'Kunal', lastName: 'Shah', email: 'finance@bluebird.example.com', mobile: '+919000000778' },
  communication: { email: 'hello@bluebird.example.com', mobile: '+919000000777', website: '' },
  address: { line1: '14 Riverside Plaza', line2: '', country: 'India', state: 'Maharashtra', city: 'Pune', postalCode: '411001' },
  acknowledged: true,
};
async function upload(appId: string, token: string, file: string, type: string) {
  const fd = new FormData();
  fd.append('file', new File([fs.readFileSync(`fixtures/documents/${file}`)], file, { type }));
  const res = await docs.POST(new Request(`http://localhost/api/v1/applications/${appId}/documents`, { method: 'POST', body: fd, headers: { 'x-application-token': token } }), { params: Promise.resolve({ id: appId }) });
  return { status: res.status, json: await res.json() };
}

describe('Auth, onboarding, KYC, approval, users and isolation', () => {
  let appId = ''; let token = '';
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('AUTH: valid login sets HttpOnly cookie; bad password rejected; client role is ignored', async () => {
    const ok = await call(login.POST, { body: { email: U.sky, password: PW } });
    expect(ok.status).toBe(200);
    expect(ok.res.headers.get('set-cookie')).toMatch(/HttpOnly/);
    const bad = await call(login.POST, { body: { email: U.sky, password: 'nope', role: 'SUPER_ADMIN' } });
    expect(bad.status).toBe(401);
    const who = await call(me.GET, { as: U.sky });
    expect(who.data.role).toBe('AGENCY_AGENT');
    expect((await call(me.GET, {})).status).toBe(401);
  });
  it('TC-001 Bluebird draft → submitted; reference + Ops queue item', async () => {
    const c = await call(apps.POST, { body: { draft: {} } });
    expect(c.status).toBe(201);
    appId = c.data.id; token = c.data.token;
    expect(c.data.status).toBe('DRAFT');
    const before = (await call(opsApps.GET, { as: U.ops })).data.length;
    const up = await upload(appId, token, 'sample-company-registration.pdf', 'application/pdf');
    expect(up.status).toBe(200);
    await upload(appId, token, 'sample-pan-card.pdf', 'application/pdf');
    await upload(appId, token, 'sample-identity-masked.pdf', 'application/pdf');
    const sub = await call(submit.POST, { url: `/api/v1/applications/${appId}/submit`, params: { id: appId }, body: { draft }, headers: { 'x-application-token': token } });
    expect(sub.status, JSON.stringify(sub.error)).toBe(200);
    expect(sub.data.status).toBe('SUBMITTED');
    const after = (await call(opsApps.GET, { as: U.ops })).data;
    expect(after.length).toBe(before + 1);
    expect(after.some((a: any) => a.id === appId && a.reference.startsWith('HF-APP-'))).toBe(true);
    expect(db.select().from(s.agencies).all().some((a) => a.displayName === 'Bluebird Travels')).toBe(false);
    const np = db.select().from(s.registrationApplications).where(eq(s.registrationApplications.id, 'APP0042')).get()!;
    expect(np.status).toBe('SUBMITTED');
  });
  it('TC-002 missing/malformed fields → field errors; no submission', async () => {
    const c = await call(apps.POST, { body: { draft: {} } });
    const bad = { ...draft, director: { ...draft.director, email: 'not-an-email' }, address: { ...draft.address, postalCode: '' }, acknowledged: false };
    const r = await call(submit.POST, { params: { id: c.data.id }, body: { draft: bad }, headers: { 'x-application-token': c.data.token } });
    expect(r.status).toBe(422);
    expect(r.error.code).toBe('VALIDATION_ERROR');
    const st = await call(appOne.GET, { params: { id: c.data.id }, headers: { 'x-application-token': c.data.token } });
    expect(st.data.status).toBe('DRAFT');
    const dup = await call(submit.POST, { params: { id: c.data.id }, body: { draft }, headers: { 'x-application-token': c.data.token } });
    expect(dup.status).toBe(409); // duplicate PAN against the submitted Bluebird application
  });
  it('TC-003 supported PDF extracts editable fields with source + confidence; low-confidence flagged', async () => {
    const c = await call(apps.POST, { body: { draft: {} } });
    const up = await upload(c.data.id, c.data.token, 'sample-company-registration.pdf', 'application/pdf');
    const f = Object.fromEntries(up.json.data.fields.map((x: any) => [x.name, x]));
    expect(up.json.data.engine).toBe('PDF_TEXT');
    expect(f.agencyName.value).toBe('Bluebird Travels');
    expect(f.agencyName.confidence).toBeGreaterThan(0.9);
    expect(f.city.value).toBe('Pune');
    expect(f.website.reviewRequired).toBe(true);
    expect(up.json.data.verificationStatus).toBe('NOT_RUN');
  });
  it('TC-004 unreadable PNG / unsupported file → graceful manual-review, no fabricated fields', async () => {
    const c = await call(apps.POST, { body: { draft: {} } });
    const up = await upload(c.data.id, c.data.token, 'sample-unreadable-scan.png', 'image/png');
    expect(up.status).toBe(200);
    expect(up.json.data.fields).toHaveLength(0);
    expect(up.json.data.errorCode).toBe('DOCUMENT_UNREADABLE');
    const fd = new FormData(); fd.append('file', new File(['<html>x</html>'], 'x.pdf', { type: 'application/pdf' }));
    const res = await docs.POST(new Request('http://localhost/x', { method: 'POST', body: fd, headers: { 'x-application-token': c.data.token } }), { params: Promise.resolve({ id: c.data.id }) });
    expect(res.status).toBe(422);
  });
  it('TC-005 extracted ≠ verified: no KYC check exists before mock verification', async () => {
    const d = (await call(opsAppOne.GET, { as: U.ops, params: { id: appId } })).data;
    expect(d.documents.length).toBe(3);
    expect(d.kyc.PAN).toBeNull();
    expect(d.draft.organization.pan).toMatch(/••/);
  });
  it('TC-006 mock PAN/identity verification then approval creates exactly one agency + admin', async () => {
    const early = await call(decision.POST, { as: U.ops, params: { id: appId }, body: { decision: 'APPROVE' } });
    expect(early.status).toBe(409);
    const fail = await call(verify.POST, { as: U.ops, params: { id: appId }, body: { checkType: 'PAN', scenario: 'kyc_fail' } });
    expect(fail.data.result).toBe('FAILED');
    expect((await call(decision.POST, { as: U.ops, params: { id: appId }, body: { decision: 'APPROVE' } })).status).toBe(409);
    expect((await call(verify.POST, { as: U.ops, params: { id: appId }, body: { checkType: 'PAN' } })).data.result).toBe('VERIFIED');
    expect((await call(verify.POST, { as: U.ops, params: { id: appId }, body: { checkType: 'IDENTITY' } })).data.result).toBe('VERIFIED');
    expect((await call(verify.POST, { as: U.cxo, params: { id: appId }, body: { checkType: 'PAN' } })).status).toBe(403);
    const ok = await call(decision.POST, { as: U.ops, params: { id: appId }, body: { decision: 'APPROVE', note: 'Docs OK' } });
    expect(ok.status).toBe(200);
    expect(ok.data.agencyId).toBe('agency_bluebird_travels');
    const twice = await call(decision.POST, { as: U.ops, params: { id: appId }, body: { decision: 'APPROVE' } });
    expect(twice.status).toBe(409);
    expect(db.select().from(s.agencies).all().filter((a) => a.displayName === 'Bluebird Travels')).toHaveLength(1);
    const admin = await call(login.POST, { body: { email: 'riya@bluebird.example.com', password: PW } });
    expect(admin.data.role).toBe('AGENCY_ADMIN');
    const rej = await call(decision.POST, { as: U.ops, params: { id: 'APP0042' }, body: { decision: 'REJECT' } });
    expect(rej.status).toBe(422); // reason required
  });
  it('TC-007 Agency Admin creates & deactivates a sub-user within own agency; reload reflects it', async () => {
    const c = await call(users.POST, { as: U.skyA, body: { name: 'Neel Agent', email: 'neel@skyline.example.com', mobile: '+919200000099', role: 'AGENCY_AGENT', agencyId: 'agency_orbit', permissions: { BOOK: true, CANCEL: false, FINANCE_VIEW: false } } });
    expect(c.status).toBe(403); // cannot target another agency
    const ok = await call(users.POST, { as: U.skyA, body: { name: 'Neel Agent', email: 'neel@skyline.example.com', mobile: '+919200000099', role: 'AGENCY_AGENT', permissions: { BOOK: true, CANCEL: false, FINANCE_VIEW: false } } });
    expect(ok.status).toBe(201);
    expect(ok.data.agencyId).toBe('agency_skyline');
    const dupe = await call(users.POST, { as: U.skyA, body: { name: 'Dup', email: 'neel@skyline.example.com', mobile: '+919200000098', role: 'AGENCY_AGENT' } });
    expect(dupe.status).toBe(409);
    const neel = await call(login.POST, { body: { email: 'neel@skyline.example.com', password: PW } });
    expect(neel.status).toBe(200);
    expect((await call(wallet.GET, { as: 'neel@skyline.example.com' })).status).toBe(403);
    const hubRole = await call(userOne.PATCH, { as: U.skyA, method: 'PATCH', params: { id: ok.data.id }, body: { role: 'SUPER_ADMIN' } });
    expect(hubRole.status).toBe(403);
    const de = await call(userOne.PATCH, { as: U.skyA, method: 'PATCH', params: { id: ok.data.id }, body: { status: 'INACTIVE' } });
    expect(de.data.status).toBe('INACTIVE');
    expect((await call(me.GET, { as: 'neel@skyline.example.com' })).status).toBe(401);
    const list = (await call(users.GET, { as: U.skyA, url: '/api/v1/agency-users?agencyId=agency_orbit' })).data;
    expect(list.every((u: any) => u.agencyId === 'agency_skyline')).toBe(true);
  });
  it('TC-008 Skyline cannot read Orbit booking/refund/case — neutral 404, no leak', async () => {
    const b = await call(bookingOne.GET, { as: U.sky, params: { id: 'HFB1011' } });
    expect(b.status).toBe(404);
    expect(JSON.stringify(b.json)).not.toContain('SBX011');
    expect((await call(claimOne.GET, { as: U.sky, params: { id: 'RFD1012' } })).status).toBe(404);
    expect((await call(caseOne.GET, { as: U.sky, params: { id: 'CASE-S003' } })).status).toBe(404);
    const list = (await call(bookings.GET, { as: U.sky, url: '/api/v1/bookings?agencyId=agency_orbit' })).data;
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((x: any) => x.agencyId === 'agency_skyline')).toBe(true);
    const ops = (await call(bookingOne.GET, { as: U.ops, params: { id: 'HFB1011' } }));
    expect(ops.status).toBe(200);
  });
  it('TC-009 Aster finance viewer cannot book or manage users; CXO cannot edit credit; anonymous cannot reset', async () => {
    expect((await call(quotes.POST, { as: U.astF, body: { tripType: 'ONE_WAY', legs: [{ offerId: 'offer_015', brandId: 'brand_015_saver' }], adults: 1 } })).status).toBe(403);
    expect((await call(users.POST, { as: U.astF, body: { name: 'x', email: 'x@aster.example.com', mobile: '+919000000001', role: 'AGENCY_AGENT' } })).status).toBe(403);
    expect((await call(wallet.GET, { as: U.astF })).status).toBe(200);
    expect((await call(policies.PATCH, { as: U.cxo, method: 'PATCH', body: { agencyId: 'agency_aster', type: 'CREDIT', config: {} } })).status).toBe(403);
    expect((await call(reset.POST, { body: { confirm: 'RESET DEMO' } })).status).toBe(401);
    expect((await call(reset.POST, { as: U.fin, body: { confirm: 'RESET DEMO' } })).status).toBe(403);
  });
  it('TC-010 suspended agency cannot create new bookings; history still readable', async () => {
    db.update(s.agencies).set({ status: 'SUSPENDED' }).where(eq(s.agencies.id, 'agency_aster')).run();
    const q = await call(quotes.POST, { as: U.astA, body: { tripType: 'ONE_WAY', legs: [{ offerId: 'offer_015', brandId: 'brand_015_saver' }], adults: 1 } });
    expect(q.status).toBe(403);
    expect(q.error.code).toBe('AGENCY_INACTIVE');
    expect((await call(bookingOne.GET, { as: U.astA, params: { id: 'HFB1020' } })).status).toBe(200);
    db.update(s.agencies).set({ status: 'ACTIVE' }).where(eq(s.agencies.id, 'agency_aster')).run();
  });
});
