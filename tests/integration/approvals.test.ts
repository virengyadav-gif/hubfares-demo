import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, call, U, resetTokens } from '../helpers';
import * as s from '@/server/db/schema';
import * as policies from '@/app/api/v1/agency-policies/route';
import * as approvals from '@/app/api/v1/approvals/route';
import * as decision from '@/app/api/v1/approvals/[id]/decision/route';
import * as agency from '@/app/api/v1/agencies/[id]/route';
import * as quotes from '@/app/api/v1/quotes/route';

let db: ReturnType<typeof freshDb>;
const cfg = { cycle: 'DAILY', termDays: 1, creditEnabled: true, creditLimitMinor: 8000000, blockOnOverdue: true, allowWalletWhenCreditBlocked: true };
describe('P2-42 maker-checker approvals (CXO approves critical OTA changes)', () => {
  beforeAll(() => { db = freshDb(); resetTokens(); });
  it('Super Admin credit-limit increase is queued, shown to CXO, and not applied yet', async () => {
    const r = await call(policies.PATCH, { as: U.super, method: 'PATCH', body: { agencyId: 'agency_aster', type: 'CREDIT', config: cfg } });
    expect(r.data.status).toBe('PENDING_APPROVAL');
    expect(r.data.message).toMatch(/approving authority/);
    const list = (await call(approvals.GET, { as: U.cxo, url: '/api/v1/approvals?status=PENDING' })).data;
    expect(list).toHaveLength(1);
    expect(list[0].summary).toMatch(/limit ₹50,000 → ₹80,000/);
    expect(db.select().from(s.agencyPolicies).where(eq(s.agencyPolicies.agencyId, 'agency_aster')).all().filter((p) => p.type === 'CREDIT')).toHaveLength(2);
    expect((await call(policies.PATCH, { as: U.fin, method: 'PATCH', body: { agencyId: 'agency_aster', type: 'CREDIT', config: cfg } })).status).toBe(409); // one pending at a time
  });
  it('CXO rejects with a reason; nothing changes. Then a new request is approved and applied (v3)', async () => {
    const id = (await call(approvals.GET, { as: U.cxo })).data[0].id;
    expect((await call(decision.POST, { as: U.cxo, params: { id }, body: { decision: 'REJECT' } })).status).toBe(422);
    expect((await call(decision.POST, { as: U.cxo, params: { id }, body: { decision: 'REJECT', note: 'Overdue first' } })).data.status).toBe('REJECTED');
    const r2 = await call(policies.PATCH, { as: U.super, method: 'PATCH', body: { agencyId: 'agency_aster', type: 'CREDIT', config: cfg } });
    const ok = await call(decision.POST, { as: U.cxo, params: { id: r2.data.approvalId }, body: { decision: 'APPROVE', note: 'Approved' } });
    expect(ok.data.status).toBe('APPROVED');
    expect(ok.data.result.id).toBe('credit_ast_v3');
    expect((await call(decision.POST, { as: U.cxo, params: { id: r2.data.approvalId }, body: { decision: 'APPROVE' } })).status).toBe(409);
  });
  it('booking block (suspend) goes through approval; ops/CXO-only permissions enforced', async () => {
    expect((await call(agency.PATCH, { as: U.ops, method: 'PATCH', params: { id: 'agency_orbit' }, body: { status: 'SUSPENDED', reason: 'Overdue review' } })).status).toBe(403);
    const r = await call(agency.PATCH, { as: U.fin, method: 'PATCH', params: { id: 'agency_orbit' }, body: { status: 'SUSPENDED', reason: 'Overdue review' } });
    expect(r.data.status).toBe('PENDING_APPROVAL');
    expect(db.select().from(s.agencies).where(eq(s.agencies.id, 'agency_orbit')).get()!.status).toBe('ACTIVE');
    await call(decision.POST, { as: U.cxo, params: { id: r.data.approvalId }, body: { decision: 'APPROVE' } });
    expect(db.select().from(s.agencies).where(eq(s.agencies.id, 'agency_orbit')).get()!.status).toBe('SUSPENDED');
    const q = await call(quotes.POST, { as: U.orbA, body: { tripType: 'ONE_WAY', legs: [{ offerId: 'offer_015', brandId: 'brand_015_saver' }], adults: 1 } });
    expect(q.error.code).toBe('AGENCY_INACTIVE');
    expect((await call(approvals.GET, { as: U.sky })).status).toBe(403);
  });
  it('refund policy changes are not critical and publish immediately', async () => {
    const r = await call(policies.PATCH, { as: U.fin, method: 'PATCH', body: { agencyId: 'agency_skyline', type: 'REFUND', config: { payoutMode: 'IMMEDIATE_IF_ELIGIBLE', autoApproveLimitMinor: 10000000 } } });
    expect(r.data.status).toBe('PUBLISHED');
  });
});
