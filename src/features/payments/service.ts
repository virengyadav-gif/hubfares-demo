/** Simulated bank events, automated matching, idempotent wallet credit, passbook, credit repayment (WF-05/06/18). */
import { and, eq, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { nextId, nextCode, nextSeq, audit, domainEvent, notify, Tx } from '@/server/db/util';
import { withIdempotency } from '@/server/idempotency';
import type { SessionCtx } from '@/server/auth/session';
import { agencyScope } from '@/server/auth/authorize';
import { AppError } from '@/shared/errors';
import { nowIso } from '@/shared/time';
import { fundingPosition } from '@/features/wallet-credit/position';
import { loadFixture } from '@/server/db/seed';

const BANK = 'BANK_VA';
export function agencyPaymentRefs(): Record<string, string> {
  return Object.fromEntries(loadFixture('agencies.json').agencies.map((a: any) => [a.paymentReference, a.id]));
}
export function paymentRefForAgency(agencyId: string): string | null {
  return Object.entries(agencyPaymentRefs()).find(([, id]) => id === agencyId)?.[0] ?? null;
}

/** Matching rules: currency INR, recognised agency virtual reference, amount equals any declared intimation. */
function evaluateMatch(tx: Tx, ev: typeof s.paymentEvents.$inferSelect): { ok: true; agencyId: string } | { ok: false; status: 'UNMATCHED' | 'EXCEPTION' | 'REJECTED'; reason: string } {
  if (ev.currency !== 'INR') return { ok: false, status: 'REJECTED', reason: `Unsupported currency ${ev.currency} — wallet credits are in INR only` };
  const m = JSON.parse(ev.matchingJson || '{}');
  const agencyId = ev.agencyId ?? agencyPaymentRefs()[ev.agencyHint ?? ''];
  if (!agencyId) return { ok: false, status: 'UNMATCHED', reason: `Unrecognised agency reference "${ev.agencyHint ?? '—'}"` };
  const ag = tx.select().from(s.agencies).where(eq(s.agencies.id, agencyId)).get();
  if (!ag || ag.status !== 'ACTIVE') return { ok: false, status: 'EXCEPTION', reason: 'Agency not active' };
  if (m.expectedAmountMinor && m.expectedAmountMinor !== ev.grossAmountMinor) return { ok: false, status: 'EXCEPTION', reason: `Amount mismatch: intimation INR ${(m.expectedAmountMinor / 100).toFixed(2)}, received INR ${(ev.grossAmountMinor / 100).toFixed(2)}` };
  return { ok: true, agencyId };
}
function creditWallet(tx: Tx, ctx: SessionCtx | null, ev: typeof s.paymentEvents.$inferSelect, agencyId: string, by: string) {
  const at = nowIso();
  const wle = nextId(tx, 'wle');
  tx.insert(s.walletLedgerEntries).values({ id: wle, agencyId, type: 'PAYMENT_CREDIT', direction: 'CREDIT', amountMinor: ev.grossAmountMinor, currency: 'INR', externalRef: ev.externalPaymentRef, description: `Bank transfer ${ev.externalPaymentRef} matched`, idempotencyKey: `payment:${BANK}:${ev.externalPaymentRef}`, createdAt: at }).run();
  tx.insert(s.paymentMatches).values({ id: nextId(tx, 'pmatch'), paymentEventId: ev.id, agencyId, status: 'CREDITED', matchedAt: at, matchedBy: by, ledgerEntryId: wle }).run();
  tx.update(s.paymentEvents).set({ status: 'CREDITED', agencyId, matchingJson: JSON.stringify({ ...JSON.parse(ev.matchingJson || '{}'), matchedAt: at, ledgerEntryId: wle, matchedBy: by }) }).where(eq(s.paymentEvents.id, ev.id)).run();
  audit(tx, { userId: ctx?.userId ?? null, role: ctx?.role ?? 'SYSTEM' }, 'PAYMENT_MATCHED', 'payment_event', ev.id, agencyId, { ref: ev.externalPaymentRef, amountMinor: ev.grossAmountMinor });
  domainEvent(tx, 'payment.credited', 'payment_event', ev.id, agencyId, { amountMinor: ev.grossAmountMinor });
  notify(tx, { audience: 'AGENCY', agencyId, kind: 'PAYMENT_CREDITED', referenceId: ev.id, title: `Wallet credited ₹${(ev.grossAmountMinor / 100).toFixed(2)} — bank transfer ${ev.externalPaymentRef}` });
  return wle;
}
export function matchPaymentEvent(db: DB, ctx: SessionCtx | null, eventId: string, idemKey: string, by = 'AUTO_MATCHER') {
  return db.transaction((tx) => withIdempotency(tx, 'payment.match', `${eventId}:${idemKey}`, { userId: ctx?.userId ?? null, agencyId: null }, { eventId }, () => {
    const ev = tx.select().from(s.paymentEvents).where(eq(s.paymentEvents.id, eventId)).get();
    if (!ev) throw new AppError('NOT_FOUND', 'Payment event not found');
    if (ev.status === 'CREDITED') return { eventId, status: 'ALREADY_PROCESSED', duplicate: true, walletCredited: false };
    const r = evaluateMatch(tx, ev);
    if (!r.ok) {
      tx.update(s.paymentEvents).set({ status: r.status, matchingJson: JSON.stringify({ ...JSON.parse(ev.matchingJson || '{}'), reason: r.reason, evaluatedAt: nowIso() }) }).where(eq(s.paymentEvents.id, ev.id)).run();
      audit(tx, { userId: ctx?.userId ?? null, role: ctx?.role ?? 'SYSTEM' }, `PAYMENT_${r.status}`, 'payment_event', ev.id, null, { reason: r.reason });
      notify(tx, { audience: 'HUB', kind: 'PAYMENT_EXCEPTION', referenceId: ev.id, title: `Payment ${ev.externalPaymentRef}: ${r.status.toLowerCase()} — ${r.reason}` });
      return { eventId, status: r.status, reason: r.reason, walletCredited: false };
    }
    const wle = creditWallet(tx, ctx, ev, r.agencyId, by);
    return { eventId, status: 'CREDITED', agencyId: r.agencyId, walletLedgerEntryId: wle, walletCredited: true };
  }));
}
/** Webhook replay of an existing external reference: returns prior state, never a second row or credit. */
export function replayPaymentEvent(db: DB, ctx: SessionCtx, externalRef: string) {
  return db.transaction((tx) => {
    const ev = tx.select().from(s.paymentEvents).where(and(eq(s.paymentEvents.providerCode, BANK), eq(s.paymentEvents.externalPaymentRef, externalRef))).get();
    if (!ev) throw new AppError('NOT_FOUND', 'No payment event with that reference');
    tx.update(s.paymentEvents).set({ replayCount: ev.replayCount + 1 }).where(eq(s.paymentEvents.id, ev.id)).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'PAYMENT_REPLAY_IGNORED', 'payment_event', ev.id, ev.agencyId, { ref: externalRef });
    return { eventId: ev.id, status: ev.status === 'CREDITED' ? 'DUPLICATE_EVENT' : ev.status, duplicate: true, walletCredited: false, message: 'Duplicate webhook/event replay detected — original result returned, no new ledger entry' };
  });
}
export const demoPaymentSchema = z.object({ amountMinor: z.number().int().min(100000).max(50000000) });
/** OTA-initiated simulated transfer: creates an event and runs the automated matcher once. */
export function simulateTransfer(db: DB, ctx: SessionCtx, amountMinor: number, idemKey: string) {
  const agencyId = ctx.agencyId!;
  const ref = paymentRefForAgency(agencyId) ?? `HFVA-${agencyId}`;
  const res = db.transaction((tx) => withIdempotency(tx, 'payment.demo_initiate', idemKey, { userId: ctx.userId, agencyId }, { amountMinor }, () => {
    const id = nextCode(tx, 'PAY', 2000);
    const extRef = `UTR2611${5000 + nextSeq(tx, 'utr')}`;
    tx.insert(s.paymentEvents).values({ id, providerCode: BANK, agencyId: null, agencyHint: ref, externalPaymentRef: extRef, grossAmountMinor: amountMinor, currency: 'INR', status: 'RECEIVED', receivedAt: nowIso(), matchingJson: JSON.stringify({ initiatedBy: ctx.userId }) }).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'PAYMENT_INITIATED', 'payment_event', id, agencyId, { amountMinor, extRef });
    return { eventId: id, externalRef: extRef };
  }));
  const m = matchPaymentEvent(db, ctx, res.result.eventId, `auto:${res.result.eventId}`);
  return { ...res.result, match: m.result, replay: res.replay };
}
export const resolveSchema = z.object({ agencyId: z.string(), note: z.string().min(3).max(200) });
/** Guided manual resolution: Finance assigns a verified agency to an UNMATCHED event, then the matcher runs (auditable). */
export function resolveUnmatched(db: DB, ctx: SessionCtx, eventId: string, input: z.infer<typeof resolveSchema>, idemKey: string) {
  db.transaction((tx) => {
    const ev = tx.select().from(s.paymentEvents).where(eq(s.paymentEvents.id, eventId)).get();
    if (!ev) throw new AppError('NOT_FOUND', 'Payment event not found');
    if (ev.status !== 'UNMATCHED') throw new AppError('INVALID_STATE', 'Only UNMATCHED events can be manually assigned (amount/currency exceptions must be rejected or re-sent)');
    if (!tx.select().from(s.agencies).where(eq(s.agencies.id, input.agencyId)).get()) throw new AppError('VALIDATION_ERROR', 'Unknown agency');
    tx.update(s.paymentEvents).set({ agencyId: input.agencyId, status: 'RECEIVED', matchingJson: JSON.stringify({ ...JSON.parse(ev.matchingJson), manualAssignment: { by: ctx.userId, note: input.note, at: nowIso() } }) }).where(eq(s.paymentEvents.id, eventId)).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'PAYMENT_MANUAL_ASSIGN', 'payment_event', eventId, input.agencyId, { note: input.note });
  });
  return matchPaymentEvent(db, ctx, eventId, idemKey, `MANUAL:${ctx.userId}`).result;
}
export function rejectPayment(db: DB, ctx: SessionCtx, eventId: string) {
  return db.transaction((tx) => {
    const ev = tx.select().from(s.paymentEvents).where(eq(s.paymentEvents.id, eventId)).get();
    if (!ev) throw new AppError('NOT_FOUND', 'Payment event not found');
    if (ev.status === 'CREDITED') throw new AppError('INVALID_STATE', 'A credited payment cannot be rejected; post a compensating reversal instead');
    tx.update(s.paymentEvents).set({ status: 'REJECTED' }).where(eq(s.paymentEvents.id, eventId)).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'PAYMENT_REJECTED', 'payment_event', eventId, ev.agencyId);
    return { eventId, status: 'REJECTED' };
  });
}
export function listPaymentEvents(db: Tx, ctx: SessionCtx, agencyId?: string) {
  const scope = agencyScope(ctx, agencyId);
  let rows = db.select().from(s.paymentEvents).orderBy(desc(s.paymentEvents.receivedAt)).all();
  if (scope) { const ref = paymentRefForAgency(scope); rows = rows.filter((r) => r.agencyId === scope || (!r.agencyId && r.agencyHint === ref && r.status !== 'CREDITED')); }
  const names = Object.fromEntries(db.select().from(s.agencies).all().map((a) => [a.id, a.displayName]));
  return rows.map((r) => { const m = JSON.parse(r.matchingJson); return { ...r, agencyName: r.agencyId ? names[r.agencyId] : null, matching: m, matchingJson: undefined, bankStatus: 'Received', ...reconStatus(r.status, m) }; });
}
/** Display reconciliation status: every bank event is Received; matching then yields Awaiting Match / Matched / Unmatched / Rejected with a reason. */
export function reconStatus(status: string, m: any): { reconStatus: 'Awaiting Match' | 'Matched' | 'Unmatched' | 'Rejected'; exceptionReason: string | null } {
  if (status === 'CREDITED' || status === 'MATCHED') return { reconStatus: 'Matched', exceptionReason: null };
  if (status === 'REJECTED') return { reconStatus: 'Rejected', exceptionReason: m?.reason ?? 'Rejected by Finance' };
  if (status === 'UNMATCHED' || status === 'EXCEPTION') return { reconStatus: 'Unmatched', exceptionReason: m?.reason ?? 'No matching agency reference' };
  return { reconStatus: 'Awaiting Match', exceptionReason: null };
}

export function walletSummary(db: Tx, ctx: SessionCtx, agencyId?: string) {
  const id = agencyScope(ctx, agencyId);
  if (!id) throw new AppError('VALIDATION_ERROR', 'Select an agency');
  const pos = fundingPosition(db, id, nowIso());
  const ag = db.select().from(s.agencies).where(eq(s.agencies.id, id)).get();
  const refund = db.select().from(s.agencyPolicies).where(and(eq(s.agencyPolicies.agencyId, id), eq(s.agencyPolicies.type, 'REFUND'))).all();
  return { ...pos, agencyName: ag?.displayName, paymentReference: paymentRefForAgency(id), bankDetails: { beneficiary: 'Hubfares Distribution Pvt Ltd', bank: 'Hubfares collections account', virtualAccount: paymentRefForAgency(id), ifsc: 'HUBF0000001', note: 'Quote the virtual account reference so the transfer is matched automatically' }, refundPolicies: refund.map((r) => ({ id: r.id, version: r.version, effectiveFrom: r.effectiveFrom, config: JSON.parse(r.configJson) })) };
}
export const passbookSchema = z.object({ agencyId: z.string().optional(), from: z.string().optional(), to: z.string().optional(), q: z.string().optional() });
/** Live passbook from the wallet ledger: opening balance (before window) + entries + running closing balance. */
export function passbook(db: Tx, ctx: SessionCtx, f: z.infer<typeof passbookSchema>) {
  const id = agencyScope(ctx, f.agencyId);
  if (!id) throw new AppError('VALIDATION_ERROR', 'Select an agency');
  const all = db.select().from(s.walletLedgerEntries).where(eq(s.walletLedgerEntries.agencyId, id)).orderBy(s.walletLedgerEntries.createdAt, s.walletLedgerEntries.id).all();
  const signed = (e: typeof all[number]) => (e.direction === 'CREDIT' ? e.amountMinor : -e.amountMinor);
  let opening = 0; let running = 0; const entries: any[] = [];
  for (const e of all) {
    if (f.from && e.createdAt < f.from) { opening += signed(e); running = opening; continue; }
    if (f.to && e.createdAt > f.to) continue;
    running += signed(e);
    entries.push({ ...e, signedMinor: signed(e), balanceAfterMinor: running });
  }
  let rows = entries;
  if (f.q) { const q = f.q.toUpperCase(); rows = rows.filter((e) => (e.bookingId ?? '').toUpperCase().includes(q) || (e.externalRef ?? '').toUpperCase().includes(q) || (e.refundId ?? '').toUpperCase().includes(q) || e.description.toUpperCase().includes(q)); }
  const credit = db.select().from(s.creditLedgerEntries).where(eq(s.creditLedgerEntries.agencyId, id)).orderBy(desc(s.creditLedgerEntries.createdAt)).all();
  return { agencyId: id, openingBalanceMinor: opening, closingBalanceMinor: running, totalCreditsMinor: entries.filter((e) => e.direction === 'CREDIT').reduce((a, e) => a + e.amountMinor, 0), totalDebitsMinor: entries.filter((e) => e.direction === 'DEBIT').reduce((a, e) => a + e.amountMinor, 0), entries: rows.reverse(), creditEntries: credit, source: 'LIVE_LEDGER' };
}
export const repaySchema = z.object({ agencyId: z.string(), amountMinor: z.number().int().min(100).max(100000000), note: z.string().max(200).optional() });
export function recordCreditRepayment(db: DB, ctx: SessionCtx, input: z.infer<typeof repaySchema>, idemKey: string) {
  return db.transaction((tx) => withIdempotency(tx, 'credit.repayment', idemKey, { userId: ctx.userId, agencyId: null }, input, () => {
    const pos = fundingPosition(tx, input.agencyId, nowIso());
    if (input.amountMinor > pos.creditOutstandingMinor) throw new AppError('VALIDATION_ERROR', 'Repayment exceeds credit outstanding');
    const id = nextId(tx, 'cle');
    tx.insert(s.creditLedgerEntries).values({ id, agencyId: input.agencyId, type: 'REPAYMENT', direction: 'REPAY', amountMinor: input.amountMinor, description: `Credit repayment${input.note ? ` — ${input.note}` : ''}`, idempotencyKey: `repay:${idemKey}`, createdAt: nowIso() }).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'CREDIT_REPAYMENT', 'agency', input.agencyId, input.agencyId, { amountMinor: input.amountMinor });
    return { creditEntryId: id, position: fundingPosition(tx, input.agencyId, nowIso()) };
  }));
}
export { inArray };
