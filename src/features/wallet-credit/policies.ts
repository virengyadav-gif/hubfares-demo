import { and, eq, desc } from 'drizzle-orm';
import { agencyPolicies } from '@/server/db/schema';
import type { Tx } from '@/server/db/util';

export type CreditConfig = { cycle: 'UPFRONT' | 'DAILY' | 'WEEKLY' | 'CUSTOM'; termDays: number; creditEnabled: boolean; creditLimitMinor: number; blockOnOverdue: boolean; allowWalletWhenCreditBlocked: boolean };
export type RefundConfig = { payoutMode: 'SUPPLIER_SETTLEMENT' | 'IMMEDIATE_IF_ELIGIBLE'; autoApproveLimitMinor: number };
export type PolicyRow = typeof agencyPolicies.$inferSelect;

/** The single enabled policy version effective at `atIso` (latest effectiveFrom ≤ at, not expired). */
export function effectivePolicy(db: Tx, agencyId: string, type: 'CREDIT' | 'REFUND', atIso: string): PolicyRow | null {
  const t = Date.parse(atIso);
  const rows = db.select().from(agencyPolicies).where(and(eq(agencyPolicies.agencyId, agencyId), eq(agencyPolicies.type, type), eq(agencyPolicies.enabled, true))).orderBy(desc(agencyPolicies.effectiveFrom), desc(agencyPolicies.version)).all();
  return rows.find((r) => Date.parse(r.effectiveFrom) <= t && (!r.effectiveUntil || Date.parse(r.effectiveUntil) > t)) ?? null;
}
export const creditCfg = (p: PolicyRow | null): CreditConfig => (p ? JSON.parse(p.configJson) : { cycle: 'UPFRONT', termDays: 0, creditEnabled: false, creditLimitMinor: 0, blockOnOverdue: true, allowWalletWhenCreditBlocked: true });
export const refundCfg = (p: PolicyRow): RefundConfig => JSON.parse(p.configJson);
