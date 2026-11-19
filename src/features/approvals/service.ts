/**
 * Maker-checker for critical OTA changes (P2-42). A Hubfares admin (maker) submits the change; it waits as PENDING
 * until the approving authority (CXO) approves it — only then is it applied. Makers cannot approve their own request.
 */
import { and, eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { nextCode, audit, notify, Tx } from '@/server/db/util';
import type { SessionCtx } from '@/server/auth/session';
import { AppError } from '@/shared/errors';
import { nowIso } from '@/shared/time';
import { publishPolicyTx, validatePolicyConfig } from '@/features/commercials/service';

export type ApprovalKind = 'CREDIT_POLICY_CHANGE' | 'AGENCY_STATUS_CHANGE';
export const APPROVER_LABEL = 'CXO (approving authority)';
const inr = (m: number) => `₹${(m / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function describe(tx: Tx, kind: ApprovalKind, agencyId: string, payload: any): string {
  const ag = tx.select().from(s.agencies).where(eq(s.agencies.id, agencyId)).get();
  const name = ag?.displayName ?? agencyId;
  if (kind === 'AGENCY_STATUS_CHANGE') return `${payload.status === 'SUSPENDED' ? 'Block bookings for' : 'Restore bookings for'} ${name}${payload.reason ? ` — ${payload.reason}` : ''}`;
  const c = payload.config;
  const cur = tx.select().from(s.agencyPolicies).where(and(eq(s.agencyPolicies.agencyId, agencyId), eq(s.agencyPolicies.type, 'CREDIT'))).orderBy(desc(s.agencyPolicies.version)).get();
  const prev = cur ? JSON.parse(cur.configJson) : null;
  const parts = [`${name}: ${c.creditEnabled ? `${c.cycle.toLowerCase()} credit, limit ${inr(c.creditLimitMinor)}` : 'prepaid (no credit)'}`];
  if (prev && prev.creditLimitMinor !== c.creditLimitMinor) parts.push(`limit ${inr(prev.creditLimitMinor)} → ${inr(c.creditLimitMinor)}`);
  if (prev && prev.blockOnOverdue !== c.blockOnOverdue) parts.push(c.blockOnOverdue ? 'block on overdue ON' : 'block on overdue OFF');
  return parts.join(' · ');
}

export function requestApproval(db: DB, ctx: SessionCtx, r: { kind: ApprovalKind; agencyId: string; payload: Record<string, unknown> }) {
  return db.transaction((tx) => {
    if (!tx.select().from(s.agencies).where(eq(s.agencies.id, r.agencyId)).get()) throw new AppError('NOT_FOUND', 'Agency not found');
    const dup = tx.select().from(s.approvalRequests).where(and(eq(s.approvalRequests.status, 'PENDING'), eq(s.approvalRequests.kind, r.kind), eq(s.approvalRequests.agencyId, r.agencyId))).get();
    if (dup) throw new AppError('INVALID_STATE', `A ${r.kind === 'CREDIT_POLICY_CHANGE' ? 'credit policy change' : 'booking status change'} for this agency is already awaiting approval (${dup.id})`);
    const id = nextCode(tx, 'APR', 1000);
    const at = nowIso();
    const summary = describe(tx, r.kind, r.agencyId, r.payload);
    tx.insert(s.approvalRequests).values({ id, kind: r.kind, agencyId: r.agencyId, summary, payloadJson: JSON.stringify(r.payload), status: 'PENDING', requestedBy: ctx.userId!, requestedByName: ctx.name, requestedAt: at }).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'APPROVAL_REQUESTED', 'approval', id, r.agencyId, { kind: r.kind, summary });
    notify(tx, { audience: 'HUB', agencyId: r.agencyId, kind: 'APPROVAL_REQUIRED', referenceId: id, title: `Approval required: ${summary}` });
    return { status: 'PENDING_APPROVAL' as const, approvalId: id, summary, approver: APPROVER_LABEL, message: `Sent to the approving authority (${APPROVER_LABEL}). The change applies after approval.` };
  });
}

export const decisionSchema = z.object({ decision: z.enum(['APPROVE', 'REJECT']), note: z.string().trim().max(300).optional() });
export function decideApproval(db: DB, ctx: SessionCtx, id: string, i: z.infer<typeof decisionSchema>) {
  return db.transaction((tx) => {
    const a = tx.select().from(s.approvalRequests).where(eq(s.approvalRequests.id, id)).get();
    if (!a) throw new AppError('NOT_FOUND', 'Approval request not found');
    if (a.status !== 'PENDING') throw new AppError('INVALID_STATE', `This request is already ${a.status.toLowerCase()}`);
    if (a.requestedBy === ctx.userId) throw new AppError('FORBIDDEN', 'The requester cannot approve their own change');
    if (i.decision === 'REJECT' && !i.note) throw new AppError('VALIDATION_ERROR', 'Add a reason for rejecting');
    const at = nowIso();
    const payload = JSON.parse(a.payloadJson);
    let result: unknown = null;
    if (i.decision === 'APPROVE') {
      if (a.kind === 'CREDIT_POLICY_CHANGE') {
        const cfg = validatePolicyConfig('CREDIT', payload.config);
        result = publishPolicyTx(tx, { userId: a.requestedBy, role: 'MAKER' }, a.agencyId!, 'CREDIT', cfg, { approvalId: id, approvedBy: ctx.userId });
      } else {
        tx.update(s.agencies).set({ status: payload.status }).where(eq(s.agencies.id, a.agencyId!)).run();
        audit(tx, { userId: a.requestedBy, role: 'MAKER' }, payload.status === 'SUSPENDED' ? 'AGENCY_SUSPENDED' : 'AGENCY_REACTIVATED', 'agency', a.agencyId!, a.agencyId, { approvalId: id, approvedBy: ctx.userId, reason: payload.reason ?? null });
        result = { agencyId: a.agencyId, status: payload.status };
      }
    }
    tx.update(s.approvalRequests).set({ status: i.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', decidedBy: ctx.userId, decidedByName: ctx.name, decidedAt: at, decisionNote: i.note ?? null, resultJson: result ? JSON.stringify(result) : null }).where(eq(s.approvalRequests.id, id)).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, i.decision === 'APPROVE' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED', 'approval', id, a.agencyId, { kind: a.kind, note: i.note ?? null });
    notify(tx, { audience: 'HUB', agencyId: a.agencyId, kind: i.decision === 'APPROVE' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED', referenceId: id, title: `${i.decision === 'APPROVE' ? 'Approved and applied' : 'Rejected'}: ${a.summary}` });
    return { id, status: i.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', result };
  });
}

export function listApprovals(db: Tx, status?: string) {
  const ag = Object.fromEntries(db.select().from(s.agencies).all().map((a) => [a.id, a.displayName]));
  return db.select().from(s.approvalRequests).where(status ? eq(s.approvalRequests.status, status) : undefined).orderBy(desc(s.approvalRequests.requestedAt), desc(s.approvalRequests.id)).all()
    .map((a) => ({ ...a, agencyName: a.agencyId ? ag[a.agencyId] : null, payload: JSON.parse(a.payloadJson), result: a.resultJson ? JSON.parse(a.resultJson) : null, payloadJson: undefined, resultJson: undefined }));
}

export const agencyStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().trim().min(3).max(200) });
export function requestAgencyStatus(db: DB, ctx: SessionCtx, agencyId: string, i: z.infer<typeof agencyStatusSchema>) {
  const a = db.select().from(s.agencies).where(eq(s.agencies.id, agencyId)).get();
  if (!a) throw new AppError('NOT_FOUND', 'Agency not found');
  if (a.status === i.status) throw new AppError('INVALID_STATE', `Agency is already ${i.status.toLowerCase()}`);
  return requestApproval(db, ctx, { kind: 'AGENCY_STATUS_CHANGE', agencyId, payload: i });
}
