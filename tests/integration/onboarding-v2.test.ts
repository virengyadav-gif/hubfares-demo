import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { freshDb, call, U, resetTokens } from '../helpers';
import * as apps from '@/app/api/v1/applications/route';
import * as docs from '@/app/api/v1/applications/[id]/documents/route';
import * as submit from '@/app/api/v1/applications/[id]/submit/route';
import * as verify from '@/app/api/v1/applications/[id]/verify-demo/route';
import * as decision from '@/app/api/v1/applications/[id]/decision/route';
import * as opsAppOne from '@/app/api/v1/ops/applications/[id]/route';

const draft = {
  organization: { agencyName: 'Bluebird Travels', turnoverInr: 25000000, entityType: 'PRIVATE_LIMITED', pan: 'AAKCB0777B', gstin: '27AAKCB0777B1Z1', registrationNumber: 'U63090MH2021PTC000777', website: '' },
  director: { salutation: 'Ms', firstName: 'Riya', lastName: 'Kulkarni', email: 'riya@bluebird.example.com', mobile: '+919000000777' },
  finance: { salutation: 'Mr', firstName: 'Kunal', lastName: 'Shah', email: 'finance@bluebird.example.com', mobile: '+919000000778' },
  communication: { email: 'hello@bluebird.example.com', mobile: '+919000000777', website: '' },
  address: { line1: '14 Riverside Plaza', line2: '', country: 'India', state: 'Maharashtra', city: 'Pune', postalCode: '411001' },
  acknowledged: true,
};
async function upload(appId: string, token: string, file: string, type: string, name = file) {
  const fd = new FormData();
  fd.append('file', new File([fs.readFileSync(`fixtures/documents/${file}`)], name, { type }));
  const res = await docs.POST(new Request(`http://localhost/api/v1/applications/${appId}/documents`, { method: 'POST', body: fd, headers: { 'x-application-token': token } }), { params: Promise.resolve({ id: appId }) });
  return { status: res.status, json: await res.json() };
}
describe('P1-34 specimen PAN / Aadhaar autofill and P0-11 / P1-35 request more information', () => {
  let appId = ''; let token = '';
  beforeAll(() => { freshDb(); resetTokens(); });
  it('specimen PAN card image returns static PAN, agency name and entity type (extracted, not verified)', async () => {
    const c = await call(apps.POST, { body: { draft: {} } }); appId = c.data.id; token = c.data.token;
    const r = await upload(appId, token, 'sample-pan-card.png', 'image/png');
    expect(r.status).toBe(200);
    expect(r.json.data.status).toBe('EXTRACTED');
    expect(r.json.data.documentType).toBe('PAN');
    expect(Object.fromEntries(r.json.data.fields.map((f: any) => [f.name, f.value]))).toMatchObject({ pan: 'AAKCB0777B', agencyName: 'Bluebird Travels', entityType: 'PRIVATE_LIMITED' });
    expect(r.json.data.verificationStatus).toBe('NOT_RUN');
  });
  it('specimen Aadhaar card returns director name, salutation, masked number and address — even if renamed', async () => {
    const r = await upload(appId, token, 'sample-aadhaar-card.png', 'image/png', 'my-scan.png');
    const f = Object.fromEntries(r.json.data.fields.map((x: any) => [x.name, x.value]));
    expect(f).toMatchObject({ directorName: 'Riya Kulkarni', directorSalutation: 'Ms', maskedId: 'XXXX XXXX 4821', city: 'Pune', postalCode: '411001' });
    expect(r.json.data.documentType).toBe('IDENTITY_MASKED');
    const other = await upload(appId, token, 'sample-unreadable-scan.png', 'image/png');
    expect(other.json.data.status).toBe('NEEDS_MANUAL_REVIEW');
  });
  it('Request info emails the applicant; approve / reject / ask again stay available', async () => {
    await call(submit.POST, { body: { draft }, params: { id: appId }, headers: { 'x-application-token': token } });
    const r = await call(decision.POST, { as: U.ops, params: { id: appId }, body: { decision: 'MORE_INFO', note: 'Please share the GST certificate' } });
    expect(r.data.status).toBe('MORE_INFO_REQUIRED');
    expect(r.data.emailSentTo).toBe('riya@bluebird.example.com');
    const d = (await call(opsAppOne.GET, { as: U.ops, params: { id: appId } })).data;
    expect(d.history.some((h: any) => h.status === 'EMAIL_SENT')).toBe(true);
    const again = await call(decision.POST, { as: U.ops, params: { id: appId }, body: { decision: 'MORE_INFO', note: 'Also the address proof' } });
    expect(again.data.status).toBe('MORE_INFO_REQUIRED');
    expect((await call(verify.POST, { as: U.ops, params: { id: appId }, body: { checkType: 'PAN' } })).data.result).toBe('VERIFIED');
    const ok = await call(decision.POST, { as: U.ops, params: { id: appId }, body: { decision: 'APPROVE' } });
    expect(ok.data.status).toBe('APPROVED');
  });
});
