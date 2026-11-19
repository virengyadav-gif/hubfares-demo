/** OTA scripted Help (WF-20) and Operations case handling (WF-21). No financial or airline side effects. */
import { and, eq, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { nextSeq, audit, notify, Tx } from '@/server/db/util';
import { withIdempotency } from '@/server/idempotency';
import type { SessionCtx } from '@/server/auth/session';
import { agencyScope, assertOwned, isHub } from '@/server/auth/authorize';
import { AppError, NEUTRAL_NOT_FOUND } from '@/shared/errors';
import { nowIso, isoPlus, HOUR } from '@/shared/time';
import { cancellationQuote } from '@/features/refunds/service';

const CHAT_NOT_FOUND = 'No matching booking found for your agency. Verify the reference or contact Hubfares Support.';
/** Owned-PNR lookup under the session agency; foreign and unknown PNRs are indistinguishable. */
export function findOwnedBookingByPnr(db: Tx, ctx: SessionCtx, pnr: string) {
  const p = db.select().from(s.pnrRecords).where(eq(s.pnrRecords.gdsPnr, pnr.trim().toUpperCase())).all();
  const ids = p.map((x) => x.bookingId);
  const b = ids.length ? db.select().from(s.bookings).where(and(inArray(s.bookings.id, ids), eq(s.bookings.agencyId, ctx.agencyId!))).get() : undefined;
  if (!b) throw new AppError('TENANT_RESOURCE_NOT_FOUND', CHAT_NOT_FOUND);
  return { booking: b, pnr: p.find((x) => x.bookingId === b.id)! };
}
function simulatedFlightStatus(flightNumber: string) {
  const d = Number(flightNumber.replace(/\D/g, '').slice(-1));
  return d <= 6 ? { code: 'SCHEDULED', label: 'On schedule' } : d <= 8 ? { code: 'DELAYED', label: 'Delayed 45 min' } : { code: 'CANCELLED', label: 'Cancelled by airline' };
}
export const intentSchema = z.object({ action: z.enum(['lookup_pnr', 'lookup_case', 'flight_status', 'my_cases', 'wallet_help']), intent: z.string().max(40).optional(), option: z.string().max(40).optional(), pnr: z.string().trim().max(12).optional(), reference: z.string().trim().max(40).optional(), airline: z.string().trim().max(3).optional(), flightNumber: z.string().trim().max(20).optional(), locale: z.enum(['en', 'hi', 'hinglish']).default('en') });
export function helpIntent(db: DB, ctx: SessionCtx, i: z.infer<typeof intentSchema>) {
  const at = nowIso();
  db.insert(s.supportConversations).values({ id: `conv_${ctx.sessionId}`, agencyId: ctx.agencyId!, userId: ctx.userId, locale: i.locale, menuState: `${i.intent ?? 'MENU'}:${i.option ?? i.action}`, selectedBookingId: null, draftPayloadJson: '{}', updatedAt: at }).onConflictDoUpdate({ target: s.supportConversations.id, set: { locale: i.locale, menuState: `${i.intent ?? 'MENU'}:${i.option ?? i.action}`, updatedAt: at } }).run();
  if (i.action === 'lookup_pnr') {
    if (!i.pnr) throw new AppError('VALIDATION_ERROR', 'Enter a PNR');
    const { booking: b, pnr } = findOwnedBookingByPnr(db, ctx, i.pnr);
    const segs = db.select().from(s.bookingSegments).where(eq(s.bookingSegments.bookingId, b.id)).orderBy(s.bookingSegments.legIndex).all();
    const claim = db.select().from(s.refundClaims).where(eq(s.refundClaims.bookingId, b.id)).get();
    const tix = ['TICKETED', 'CANCELLED', 'VOIDED'].includes(b.bookingStatus) ? db.select().from(s.tickets).where(eq(s.tickets.bookingId, b.id)).all() : [];
    let estimate: any = null;
    if (b.bookingStatus === 'TICKETED') { try { const q = cancellationQuote(db, ctx, b.id, 'CANCEL'); estimate = { eligible: q.eligible, reason: q.ineligibleReason, estimatedAgencyRefundMinor: q.estimatedAgencyRefundMinor, supplierPenaltyMinor: q.supplierPenaltyMinor, serviceFeeMinor: q.serviceFeeMinor, slabs: q.segments.map((x) => `${x.route} ${x.slab}`), estimatedOnly: true }; } catch { estimate = null; } }
    return { bookingId: b.id, pnr: pnr.gdsPnr, provider: pnr.provider, route: b.routeSummary, leadPassenger: b.leadPassenger, bookingStatus: b.bookingStatus, ticketStatus: b.ticketStatus, ticketNumbers: tix.map((t) => t.ticketNumber), firstDepartureAt: b.firstDepartureAt, amountMinor: b.sellAmountMinor,
      segments: segs.map((g) => ({ route: `${g.origin}-${g.destination}`, flightNumber: g.flightNumber, departureAt: g.departureAt, originTz: g.originTz, profileId: g.fareRuleProfileId, status: simulatedFlightStatus(g.flightNumber) })),
      refund: claim ? { claimId: claim.id, agencyPayoutStatus: claim.agencyPayoutStatus, supplierSettlementStatus: claim.supplierStatus, agencyRefundMinor: claim.agencyRefundMinor, walletCreditedMinor: claim.walletCreditedMinor, status: claim.status, timeline: JSON.parse(claim.timelineJson) } : null,
      cancellationEstimate: estimate, refundPolicy: { id: b.refundPolicyId, version: b.refundPolicyVersion, payoutMode: b.refundPayoutMode }, source: 'SEEDED', flightStatusLabel: 'Simulated status' };
  }
  if (i.action === 'lookup_case') {
    const ref = (i.reference ?? '').trim();
    const claim = db.select().from(s.refundClaims).where(eq(s.refundClaims.id, ref)).get();
    if (claim && claim.agencyId === ctx.agencyId) return { kind: 'REFUND', claimId: claim.id, bookingId: claim.bookingId, agencyPayoutStatus: claim.agencyPayoutStatus, supplierSettlementStatus: claim.supplierStatus, agencyRefundMinor: claim.agencyRefundMinor, walletCreditedMinor: claim.walletCreditedMinor, status: claim.status, timeline: JSON.parse(claim.timelineJson) };
    const c = db.select().from(s.supportCases).where(eq(s.supportCases.id, ref.toUpperCase())).get();
    if (c && c.agencyId === ctx.agencyId) return { kind: 'CASE', ...caseView(db, c.id) };
    throw new AppError('TENANT_RESOURCE_NOT_FOUND', 'No matching case or refund found for your agency. Verify the reference or contact Hubfares Support.');
  }
  if (i.action === 'flight_status') {
    const fn = (i.flightNumber ?? '').toUpperCase();
    const offer = db.select().from(s.flightOffers).all().find((o) => o.flightNumber === fn || o.flightNumber.replace(/-DEMO-/, '') === fn.replace(/[- ]/g, ''));
    if (!offer) throw new AppError('NOT_FOUND', 'No seeded flight matches that airline/flight number. This demo shows simulated status for seeded flights only.');
    return { flightNumber: offer.flightNumber, route: `${offer.origin}-${offer.destination}`, departureAt: offer.departureAt, originTz: offer.originTz, status: simulatedFlightStatus(offer.flightNumber), label: 'Simulated status' };
  }
  if (i.action === 'my_cases') return listCases(db, ctx, {}).slice(0, 8);
  return { walletHelp: true };
}
export const helpCaseSchema = z.object({ category: z.enum(['REFUND_REQUEST', 'REFUND_ESCALATION', 'AMENDMENT_REQUEST', 'MODIFICATION_REQUEST', 'COMPLAINT']), subcategory: z.string().max(40), pnr: z.string().trim().max(12).optional(), details: z.string().trim().max(600).optional(), contactPreference: z.enum(['EMAIL', 'PHONE', 'PORTAL']).default('PORTAL'), locale: z.enum(['en', 'hi', 'hinglish']).default('en') });
export function createHelpCase(db: DB, ctx: SessionCtx, i: z.infer<typeof helpCaseSchema>, idemKey: string) {
  return db.transaction((tx) => withIdempotency(tx, 'help.case', idemKey, { userId: ctx.userId, agencyId: ctx.agencyId }, i, () => {
    let booking: typeof s.bookings.$inferSelect | null = null; let pnr: string | null = null;
    if (i.pnr) { const r = findOwnedBookingByPnr(tx, ctx, i.pnr); booking = r.booking; pnr = r.pnr.gdsPnr; }
    else if (i.category !== 'COMPLAINT') throw new AppError('VALIDATION_ERROR', 'A PNR from your agency is required for this request');
    const at = nowIso();
    const id = `CASE-${String(nextSeq(tx, 'case', 1001)).padStart(4, '0')}`;
    const priority = i.category === 'REFUND_ESCALATION' || i.category === 'COMPLAINT' ? 'HIGH' : 'MEDIUM';
    const summary = `${i.category.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} · ${i.subcategory.replace(/_/g, ' ').toLowerCase()}${booking ? ` · ${pnr} (${booking.routeSummary})` : ''}`;
    tx.insert(s.supportCases).values({ id, agencyId: ctx.agencyId!, userId: ctx.userId, bookingId: booking?.id ?? null, pnr, source: 'CHATBOT', category: i.category, subcategory: i.subcategory, summary, details: i.details ?? null, status: 'OPEN', assignedTo: null, priority, slaDueAt: isoPlus(at, (priority === 'HIGH' ? 4 : 24) * HOUR), idempotencyKey: idemKey, createdAt: at, updatedAt: at }).run();
    tx.insert(s.caseEvents).values({ id: `${id}_ev0`, caseId: id, actorId: ctx.userId, action: 'CREATED', fromStatus: null, toStatus: 'OPEN', note: `Created from OTA Help chatbot (${i.locale}); contact via ${i.contactPreference}`, createdAt: at }).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'SUPPORT_CASE_CREATED', 'support_case', id, ctx.agencyId, { category: i.category, bookingId: booking?.id, source: 'CHATBOT' });
    notify(tx, { audience: 'HUB', agencyId: ctx.agencyId, kind: 'CHAT_CASE', referenceId: id, title: `New chatbot case ${id} from ${ctx.agencyName}: ${summary}` });
    return { caseId: id, agencyId: ctx.agencyId, bookingId: booking?.id ?? null, source: 'CHATBOT', category: i.category, status: 'OPEN', createdAt: at, demo: true, bookingChanged: false, walletChanged: false };
  }));
}
export function caseView(db: Tx, id: string) {
  const c = db.select().from(s.supportCases).where(eq(s.supportCases.id, id)).get()!;
  const ev = db.select().from(s.caseEvents).where(eq(s.caseEvents.caseId, id)).orderBy(s.caseEvents.createdAt).all();
  const users = Object.fromEntries(db.select().from(s.users).all().map((u) => [u.id, u.name]));
  const ag = db.select().from(s.agencies).where(eq(s.agencies.id, c.agencyId)).get();
  return { ...c, agencyName: ag?.displayName, assignedToName: c.assignedTo ? users[c.assignedTo] : null, events: ev.map((e) => ({ ...e, actorName: e.actorId ? users[e.actorId] : 'System' })) };
}
export function listCases(db: Tx, ctx: SessionCtx, f: { agencyId?: string; source?: string; status?: string }) {
  const scope = agencyScope(ctx, f.agencyId);
  const conds: any[] = [];
  if (scope) conds.push(eq(s.supportCases.agencyId, scope));
  if (f.source) conds.push(eq(s.supportCases.source, f.source));
  if (f.status) conds.push(eq(s.supportCases.status, f.status));
  return db.select().from(s.supportCases).where(conds.length ? and(...conds) : undefined).orderBy(desc(s.supportCases.createdAt)).all().map((c) => caseView(db, c.id));
}
export function getCase(db: Tx, ctx: SessionCtx, id: string) {
  const c = db.select().from(s.supportCases).where(eq(s.supportCases.id, id)).get();
  if (!c) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
  assertOwned(ctx, c.agencyId);
  return caseView(db, id);
}
const FLOW: Record<string, string[]> = { OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CLOSED'], ASSIGNED: ['IN_PROGRESS', 'AWAITING_EXTERNAL', 'RESOLVED'], IN_PROGRESS: ['AWAITING_EXTERNAL', 'RESOLVED', 'ESCALATED'], AWAITING_EXTERNAL: ['IN_PROGRESS', 'RESOLVED'], ESCALATED: ['IN_PROGRESS', 'RESOLVED'], RESOLVED: ['CLOSED', 'REOPENED'], REOPENED: ['ASSIGNED', 'IN_PROGRESS'], CLOSED: ['REOPENED'] };
export const caseUpdateSchema = z.object({ status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'AWAITING_EXTERNAL', 'RESOLVED', 'CLOSED', 'ESCALATED', 'REOPENED']).optional(), assignedTo: z.string().optional(), priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(), note: z.string().max(300).optional() });
export function updateCase(db: DB, ctx: SessionCtx, id: string, i: z.infer<typeof caseUpdateSchema>) {
  return db.transaction((tx) => {
    const c = tx.select().from(s.supportCases).where(eq(s.supportCases.id, id)).get();
    if (!c) throw new AppError('NOT_FOUND', 'Case not found');
    const at = nowIso(); const set: any = { updatedAt: at };
    if (i.assignedTo) {
      const u = tx.select().from(s.users).where(eq(s.users.id, i.assignedTo)).get();
      if (!u || u.agencyId) throw new AppError('VALIDATION_ERROR', 'Assignee must be a Hubfares operator');
      set.assignedTo = i.assignedTo;
      if (c.status === 'OPEN' && !i.status) set.status = 'ASSIGNED';
    }
    if (i.status) { if (!FLOW[c.status]?.includes(i.status)) throw new AppError('INVALID_STATE', `Cannot move case from ${c.status} to ${i.status}`); set.status = i.status; }
    if (i.priority) set.priority = i.priority;
    tx.update(s.supportCases).set(set).where(eq(s.supportCases.id, id)).run();
    tx.insert(s.caseEvents).values({ id: `${id}_ev${nextSeq(tx, `caseev:${id}`, 10)}`, caseId: id, actorId: ctx.userId, action: i.assignedTo ? 'ASSIGNED' : 'STATUS_CHANGED', fromStatus: c.status, toStatus: set.status ?? c.status, note: i.note ?? null, createdAt: at }).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'SUPPORT_CASE_UPDATED', 'support_case', id, c.agencyId, i);
    if (set.status && set.status !== c.status) notify(tx, { audience: 'AGENCY', agencyId: c.agencyId, kind: 'CASE_UPDATE', referenceId: id, title: `Case ${id} is now ${set.status.replace('_', ' ').toLowerCase()}` });
    return caseView(tx, id);
  });
}
export { isHub };
