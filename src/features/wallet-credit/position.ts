/** Wallet / credit position derived ONLY from append-only ledgers and reservations (Technical Design §4.5). */
import { and, eq, sql } from 'drizzle-orm';
import { walletLedgerEntries, creditLedgerEntries, fundingReservations } from '@/server/db/schema';
import type { Tx } from '@/server/db/util';
import { effectivePolicy, creditCfg } from './policies';

export type FundingPosition = {
  agencyId: string; walletCashMinor: number; walletHoldMinor: number; availableWalletMinor: number;
  creditPolicyId: string | null; creditPolicyVersion: number | null; creditCycle: string; creditTermDays: number; creditEnabled: boolean;
  creditLimitMinor: number; creditOutstandingMinor: number; creditHoldMinor: number; overdueMinor: number; nextDueAt: string | null;
  creditBlocked: boolean; blockReason: string | null; availableCreditBeforeBlockMinor: number; availableCreditMinor: number;
  spendingPowerMinor: number; allowWalletWhenCreditBlocked: boolean;
};
export function fundingPosition(db: Tx, agencyId: string, nowIso: string): FundingPosition {
  const w = db.select({ c: sql<number>`coalesce(sum(case when direction='CREDIT' then amount_minor else 0 end),0)`, d: sql<number>`coalesce(sum(case when direction='DEBIT' then amount_minor else 0 end),0)` }).from(walletLedgerEntries).where(eq(walletLedgerEntries.agencyId, agencyId)).get()!;
  const holds = db.select({ wh: sql<number>`coalesce(sum(wallet_hold_minor),0)`, ch: sql<number>`coalesce(sum(credit_hold_minor),0)` }).from(fundingReservations).where(and(eq(fundingReservations.agencyId, agencyId), eq(fundingReservations.status, 'ACTIVE'))).get()!;
  const credit = db.select().from(creditLedgerEntries).where(eq(creditLedgerEntries.agencyId, agencyId)).orderBy(creditLedgerEntries.createdAt, creditLedgerEntries.id).all();
  const draws = credit.filter((c) => c.direction === 'DRAW');
  let repaid = credit.filter((c) => c.direction === 'REPAY').reduce((a, c) => a + c.amountMinor, 0);
  const now = Date.parse(nowIso);
  let outstanding = 0, overdue = 0; let nextDueAt: string | null = null;
  for (const d of draws) { // FIFO allocation of repayments to oldest draws
    const applied = Math.min(repaid, d.amountMinor); repaid -= applied;
    const remaining = d.amountMinor - applied;
    outstanding += remaining;
    if (remaining > 0 && d.dueAt) {
      if (Date.parse(d.dueAt) < now) overdue += remaining;
      else if (!nextDueAt || d.dueAt < nextDueAt) nextDueAt = d.dueAt;
    }
  }
  const pol = effectivePolicy(db, agencyId, 'CREDIT', nowIso);
  const cfg = creditCfg(pol);
  const walletCash = Number(w.c) - Number(w.d);
  const availableWallet = Math.max(0, walletCash - Number(holds.wh));
  const before = cfg.creditEnabled ? Math.max(0, cfg.creditLimitMinor - outstanding - Number(holds.ch)) : 0;
  const blocked = cfg.creditEnabled && cfg.blockOnOverdue && overdue > 0;
  const availableCredit = blocked ? 0 : before;
  return {
    agencyId, walletCashMinor: walletCash, walletHoldMinor: Number(holds.wh), availableWalletMinor: availableWallet,
    creditPolicyId: pol?.id ?? null, creditPolicyVersion: pol?.version ?? null, creditCycle: cfg.cycle, creditTermDays: cfg.termDays, creditEnabled: cfg.creditEnabled,
    creditLimitMinor: cfg.creditEnabled ? cfg.creditLimitMinor : 0, creditOutstandingMinor: outstanding, creditHoldMinor: Number(holds.ch), overdueMinor: overdue, nextDueAt,
    creditBlocked: blocked, blockReason: blocked ? `Overdue credit of ${overdue / 100} INR — policy v${pol?.version} blocks new credit draws` : !cfg.creditEnabled ? 'Credit facility not enabled (prepaid)' : null,
    availableCreditBeforeBlockMinor: before, availableCreditMinor: availableCredit, spendingPowerMinor: availableWallet + availableCredit,
    allowWalletWhenCreditBlocked: cfg.allowWalletWhenCreditBlocked,
  };
}
/** Reservation allocation: wallet first, remainder from eligible credit. */
export function allocateFunding(pos: FundingPosition, totalMinor: number): { walletHold: number; creditHold: number } | null {
  const walletHold = Math.min(totalMinor, pos.availableWalletMinor);
  const creditHold = totalMinor - walletHold;
  if (creditHold > pos.availableCreditMinor) return null;
  return { walletHold, creditHold };
}
