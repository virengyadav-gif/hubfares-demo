/** Core commercial rules (functional), OTA markup UI (non-executing), advanced drafts (guided), policies (CREDIT/REFUND versions). */
import { and, eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { nextId, audit, Tx } from '@/server/db/util';
import type { SessionCtx } from '@/server/auth/session';
import { agencyScope } from '@/server/auth/authorize';
import { AppError } from '@/shared/errors';
import { nowIso } from '@/shared/time';
import { requestApproval } from '@/features/approvals/service';
import { fundingPosition } from '@/features/wallet-credit/position';

// ---- core commercial rules (affect NEW quotes only) ----
export const coreRuleSchema = z.object({ label: z.string().trim().min(2).max(80), agencyId: z.string().nullable().optional(), airlineCode: z.string().trim().toUpperCase().max(3).nullable().optional(), origin: z.string().trim().toUpperCase().length(3).nullable().optional(), destination: z.string().trim().toUpperCase().length(3).nullable().optional(), fixedFeeMinor: z.number().int().min(0).max(10000000), percentBps: z.number().int().min(0).max(2000), disclosedServiceFeeMinor: z.number().int().min(0).max(1000000), priority: z.number().int().min(0).max(100), enabled: z.boolean() });
export function listCoreRules(db: Tx) {
  const ag = Object.fromEntries(db.select().from(s.agencies).all().map((a) => [a.id, a.displayName]));
  return db.select().from(s.coreCommercialRules).all().map((r) => ({ ...r, agencyName: r.agencyId ? ag[r.agencyId] : 'All agencies', history: JSON.parse(r.historyJson), historyJson: undefined }));
}
export function upsertCoreRule(db: DB, ctx: SessionCtx, id: string | null, input: z.infer<typeof coreRuleSchema>) {
  return db.transaction((tx) => {
    const at = nowIso();
    const norm = { ...input, agencyId: input.agencyId || null, airlineCode: input.airlineCode || null, origin: input.origin || null, destination: input.destination || null };
    if (!id) {
      const nid = nextId(tx, 'core_rule');
      tx.insert(s.coreCommercialRules).values({ id: nid, ...norm, rebateMinor: 0, percentageBase: 'SUPPLIER_BASE', effectiveFrom: at, effectiveUntil: null, ruleVersion: 1, historyJson: JSON.stringify([{ version: 1, at, by: ctx.name, values: norm }]), updatedAt: at }).run();
      audit(tx, { userId: ctx.userId, role: ctx.role }, 'CORE_RULE_CREATED', 'core_rule', nid, norm.agencyId, norm);
      return { id: nid, ruleVersion: 1 };
    }
    const r = tx.select().from(s.coreCommercialRules).where(eq(s.coreCommercialRules.id, id)).get();
    if (!r) throw new AppError('NOT_FOUND', 'Rule not found');
    if (r.id === 'core_global_default' && (!norm.enabled || norm.agencyId || norm.airlineCode || norm.origin)) throw new AppError('VALIDATION_ERROR', 'The global default rule must remain enabled and unrestricted (fallback)');
    const hist = JSON.parse(r.historyJson);
    const v = r.ruleVersion + 1;
    hist.push({ version: v, at, by: ctx.name, previous: { fixedFeeMinor: r.fixedFeeMinor, percentBps: r.percentBps, disclosedServiceFeeMinor: r.disclosedServiceFeeMinor, enabled: r.enabled }, values: norm });
    tx.update(s.coreCommercialRules).set({ ...norm, ruleVersion: v, effectiveFrom: at, historyJson: JSON.stringify(hist), updatedAt: at }).where(eq(s.coreCommercialRules.id, id)).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'CORE_RULE_UPDATED', 'core_rule', id, norm.agencyId, { version: v, fixedFeeMinor: norm.fixedFeeMinor, percentBps: norm.percentBps });
    return { id, ruleVersion: v, effectiveFrom: at, note: 'Applies to new quotes only; existing quotes and bookings keep their snapshot.' };
  });
}

// ---- OTA downstream markup — UI ONLY. This module is never imported by pricing. ----
export const markupSchema = z.object({ name: z.string().trim().min(2).max(60), journey: z.enum(['DOMESTIC', 'INTERNATIONAL', 'BOTH']), tripTypes: z.array(z.enum(['ONE_WAY', 'RETURN', 'MULTI_CITY'])).min(1), airlineFilter: z.string().trim().toUpperCase().default('ALL'), cabinFilter: z.enum(['ALL', 'ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']), markupKind: z.enum(['FIXED', 'PERCENT']), value: z.number().int().positive().max(10000000), targetUserIds: z.array(z.string()).max(0, 'Markup applies to every user of your agency').default([]), enabled: z.boolean() });
export function listMarkup(db: Tx, ctx: SessionCtx) {
  const scope = agencyScope(ctx);
  return db.select().from(s.agencyMarkupUiRules).where(scope ? eq(s.agencyMarkupUiRules.agencyId, scope) : undefined).all().map((m) => ({ ...m, tripTypes: JSON.parse(m.tripTypesJson), targetUserIds: JSON.parse(m.targetUserIdsJson), tripTypesJson: undefined, targetUserIdsJson: undefined, uiOnly: true }));
}
export function upsertMarkup(db: DB, ctx: SessionCtx, id: string | null, input: z.infer<typeof markupSchema>) {
  const agencyId = ctx.agencyId!;
  return db.transaction((tx) => {
    const at = nowIso();
    const values = { name: input.name, journey: input.journey, tripTypesJson: JSON.stringify(input.tripTypes), airlineFilter: input.airlineFilter || 'ALL', cabinFilter: input.cabinFilter, markupKind: input.markupKind, value: input.value, currency: input.markupKind === 'FIXED' ? 'INR' : null, targetUserIdsJson: '[]', enabled: input.enabled, updatedAt: at };
    if (id) {
      const m = tx.select().from(s.agencyMarkupUiRules).where(eq(s.agencyMarkupUiRules.id, id)).get();
      if (!m || m.agencyId !== agencyId) throw new AppError('TENANT_RESOURCE_NOT_FOUND', 'Markup rule not found');
      tx.update(s.agencyMarkupUiRules).set(values).where(eq(s.agencyMarkupUiRules.id, id)).run();
    } else { id = nextId(tx, 'markup_ui'); tx.insert(s.agencyMarkupUiRules).values({ id, agencyId, ...values }).run(); }
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'MARKUP_UI_SAVED', 'markup_ui_rule', id, agencyId, { uiOnly: true });
    return { id, uiOnly: true, notice: 'Markup saved for all users of your agency. Hubfares net fares and your wallet are not affected.' };
  });
}

// ---- Advanced builder drafts — guided; expressions are stored as plain text, never evaluated ----
export const advancedSchema = z.object({ ruleName: z.string().trim().min(2).max(80), header: z.record(z.string()), criteria: z.record(z.object({ include: z.string().max(200), exclude: z.string().max(200) })), lines: z.array(z.object({ type: z.enum(['IATA_COMMISSION', 'MARKUP', 'SERVICE_FEE']), expression: z.string().trim().max(40).regex(/^[0-9A-Z*+.\s]+$/i, 'Expression text may contain digits, BF/TF tokens and * + only'), applicableOnBooking: z.boolean(), applicableOnInfant: z.boolean(), applicableOnAllSegments: z.boolean() })).max(10), priority: z.number().int().min(0).max(999999), enabled: z.boolean(), note: z.string().max(140).optional() });
export function listAdvanced(db: Tx) {
  return db.select().from(s.advancedCommercialDrafts).orderBy(desc(s.advancedCommercialDrafts.priority)).all().map((d) => ({ ...d, header: JSON.parse(d.headerJson), criteria: JSON.parse(d.criteriaJson), lines: JSON.parse(d.expressionLinesJson), history: JSON.parse(d.historyJson), headerJson: undefined, criteriaJson: undefined, expressionLinesJson: undefined, historyJson: undefined, evaluated: false }));
}
export function saveAdvanced(db: DB, ctx: SessionCtx, id: string | null, input: z.infer<typeof advancedSchema>) {
  return db.transaction((tx) => {
    const at = nowIso();
    if (id) {
      const d = tx.select().from(s.advancedCommercialDrafts).where(eq(s.advancedCommercialDrafts.id, id)).get();
      if (!d) throw new AppError('NOT_FOUND', 'Draft not found');
      const hist = JSON.parse(d.historyJson); hist.push({ revision: d.draftRevision + 1, at, by: ctx.userId, note: input.note || 'Draft updated' });
      tx.update(s.advancedCommercialDrafts).set({ ruleName: input.ruleName, headerJson: JSON.stringify(input.header), criteriaJson: JSON.stringify(input.criteria), expressionLinesJson: JSON.stringify(input.lines), priority: input.priority, enabled: input.enabled, draftRevision: d.draftRevision + 1, historyJson: JSON.stringify(hist), updatedAt: at }).where(eq(s.advancedCommercialDrafts.id, id)).run();
    } else {
      id = nextId(tx, 'adv_draft');
      tx.insert(s.advancedCommercialDrafts).values({ id, ruleName: input.ruleName, headerJson: JSON.stringify(input.header), criteriaJson: JSON.stringify(input.criteria), expressionLinesJson: JSON.stringify(input.lines), priority: input.priority, enabled: input.enabled, draftRevision: 1, historyJson: JSON.stringify([{ revision: 1, at, by: ctx.userId, note: input.note || 'Draft created' }]), updatedAt: at }).run();
    }
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'ADVANCED_DRAFT_SAVED', 'advanced_draft', id, null, { evaluated: false });
    return { id, evaluated: false, notice: 'Draft rule — expressions such as 5*BF / 1*TF are saved for review and are not applied to pricing.' };
  });
}

// ---- Agency policies: CREDIT / REFUND versions (prospective) ----
export const creditPolicySchema = z.object({ cycle: z.enum(['UPFRONT', 'DAILY', 'WEEKLY', 'CUSTOM']), termDays: z.number().int().min(0).max(60), creditEnabled: z.boolean(), creditLimitMinor: z.number().int().min(0).max(10000000000), blockOnOverdue: z.boolean(), allowWalletWhenCreditBlocked: z.boolean() });
export const refundPolicySchema = z.object({ payoutMode: z.enum(['SUPPLIER_SETTLEMENT', 'IMMEDIATE_IF_ELIGIBLE']), autoApproveLimitMinor: z.number().int().min(0).max(10000000000) });
export function listPolicies(db: Tx, ctx: SessionCtx, agencyId?: string) {
  const scope = agencyScope(ctx, agencyId);
  const rows = db.select().from(s.agencyPolicies).where(scope ? eq(s.agencyPolicies.agencyId, scope) : undefined).orderBy(s.agencyPolicies.agencyId, s.agencyPolicies.type, desc(s.agencyPolicies.version)).all();
  return rows.map((r) => ({ ...r, config: JSON.parse(r.configJson), configJson: undefined }));
}
/** Validates a policy config (shared by maker request and checker execution). */
export function validatePolicyConfig(type: 'CREDIT' | 'REFUND', config: unknown) {
  const cfg = type === 'CREDIT' ? creditPolicySchema.parse(config) : refundPolicySchema.parse(config);
  if (type === 'CREDIT') {
    const c = cfg as z.infer<typeof creditPolicySchema>;
    const expected = { UPFRONT: 0, DAILY: 1, WEEKLY: 7 } as Record<string, number>;
    if (c.cycle !== 'CUSTOM' && expected[c.cycle] !== c.termDays) throw new AppError('VALIDATION_ERROR', `${c.cycle} cycle uses ${expected[c.cycle]} term day(s)`);
    if (c.cycle === 'UPFRONT' && c.creditEnabled) throw new AppError('VALIDATION_ERROR', 'Upfront/prepaid agencies cannot have a credit facility enabled');
  }
  return cfg;
}
/**
 * Hub policy change. REFUND policies publish immediately. CREDIT policy changes are critical (maker-checker):
 * they are queued for the approving authority and take effect only after approval.
 */
export function publishPolicy(db: DB, ctx: SessionCtx, agencyId: string, type: 'CREDIT' | 'REFUND', config: unknown) {
  const cfg = validatePolicyConfig(type, config);
  if (type === 'CREDIT') return requestApproval(db, ctx, { kind: 'CREDIT_POLICY_CHANGE', agencyId, payload: { type, config: cfg } });
  return db.transaction((tx) => publishPolicyTx(tx, { userId: ctx.userId, role: ctx.role }, agencyId, type, cfg));
}
export function publishPolicyTx(tx: Tx, actor: { userId: string | null; role: string | null }, agencyId: string, type: 'CREDIT' | 'REFUND', cfg: unknown, extra: Record<string, unknown> = {}) {
  if (!tx.select().from(s.agencies).where(eq(s.agencies.id, agencyId)).get()) throw new AppError('NOT_FOUND', 'Agency not found');
  const prev = tx.select().from(s.agencyPolicies).where(and(eq(s.agencyPolicies.agencyId, agencyId), eq(s.agencyPolicies.type, type))).orderBy(desc(s.agencyPolicies.version)).get();
  const v = (prev?.version ?? 0) + 1;
  const at = nowIso();
  const known: Record<string, string> = { agency_skyline: 'sky', agency_orbit: 'orb', agency_aster: 'ast' };
  const id = `${type.toLowerCase()}_${known[agencyId] ?? agencyId.replace('agency_', '')}_v${v}`;
  if (prev && !prev.effectiveUntil) tx.update(s.agencyPolicies).set({ effectiveUntil: at }).where(eq(s.agencyPolicies.id, prev.id)).run();
  tx.insert(s.agencyPolicies).values({ id, agencyId, type, version: v, effectiveFrom: at, effectiveUntil: null, enabled: true, configJson: JSON.stringify(cfg), createdBy: actor.userId, createdAt: at }).run();
  audit(tx, actor, `${type}_POLICY_PUBLISHED`, 'agency_policy', id, agencyId, { version: v, previous: prev ? `${prev.id} v${prev.version}` : null, config: cfg, ...extra });
  return { id, version: v, effectiveFrom: at, status: 'PUBLISHED' as const, position: type === 'CREDIT' ? fundingPosition(tx, agencyId, at) : undefined, note: type === 'REFUND' ? 'New refund policy applies to bookings created from now on; existing bookings keep their booking-time snapshot.' : 'New credit terms apply to new booking eligibility; historical draws are unchanged.' };
}
