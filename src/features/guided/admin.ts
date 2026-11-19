/** Ops overview counts, notifications, audit trail, and the protected demo reset. */
import { and, eq, desc, or, isNull, inArray } from 'drizzle-orm';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { dbFilePath } from '@/server/db/client';
import { Tx, getMeta, audit } from '@/server/db/util';
import type { SessionCtx } from '@/server/auth/session';
import { isHub } from '@/server/auth/authorize';
import { seedDatabase, anchorForSeed } from '@/server/db/seed';
import { validateSeededState } from '@/server/db/validate';
import { assertDemoDbAllowed, assertResetEnabled } from '@/server/db/guard';
import { AppError } from '@/shared/errors';
import { nowIso } from '@/shared/time';

export function opsOverview(db: Tx) {
  const apps = db.select().from(s.registrationApplications).all();
  const bookings = db.select().from(s.bookings).all();
  const claims = db.select().from(s.refundClaims).all();
  const cases = db.select().from(s.supportCases).all();
  const pays = db.select().from(s.paymentEvents).all();
  return {
    pendingApplications: apps.filter((a) => ['SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED'].includes(a.status)).length,
    bookingsToday: bookings.filter((b) => b.bookedAt.slice(0, 10) === nowIso().slice(0, 10)).length,
    bookingsTotal: bookings.length, ticketed: bookings.filter((b) => b.bookingStatus === 'TICKETED').length, pnrPending: bookings.filter((b) => b.bookingStatus === 'PNR_CREATED').length,
    failures: bookings.filter((b) => ['BOOKING_FAILED', 'TICKETING_FAILED'].includes(b.bookingStatus)).length,
    refundsPendingSupplier: claims.filter((c) => c.supplierStatus === 'PENDING').length, refundsAwaitingPayout: claims.filter((c) => c.status === 'SUPPLIER_RECEIVED_PAYOUT_ELIGIBLE' || c.agencyPayoutStatus === 'APPROVAL_PENDING').length,
    openCases: cases.filter((c) => !['RESOLVED', 'CLOSED'].includes(c.status)).length, chatbotCases: cases.filter((c) => c.source === 'CHATBOT' && !['RESOLVED', 'CLOSED'].includes(c.status)).length,
    paymentsToMatch: pays.filter((p) => p.status === 'RECEIVED').length, paymentExceptions: pays.filter((p) => ['UNMATCHED', 'EXCEPTION'].includes(p.status)).length,
    recentBookings: bookings.sort((a, b) => b.bookedAt.localeCompare(a.bookedAt)).slice(0, 6).map((b) => ({ id: b.id, agencyId: b.agencyId, route: b.routeSummary, status: b.bookingStatus, bookedAt: b.bookedAt, amountMinor: b.sellAmountMinor })),
  };
}
export function notificationsFor(db: Tx, ctx: SessionCtx) {
  const rows = isHub(ctx) ? db.select().from(s.notifications).where(eq(s.notifications.audience, 'HUB')).orderBy(desc(s.notifications.createdAt), desc(s.notifications.id)).limit(40).all()
    : db.select().from(s.notifications).where(and(eq(s.notifications.audience, 'AGENCY'), eq(s.notifications.agencyId, ctx.agencyId!), or(isNull(s.notifications.userId), eq(s.notifications.userId, ctx.userId)))).orderBy(desc(s.notifications.createdAt), desc(s.notifications.id)).limit(40).all();
  return rows.map((n) => ({ ...n, payload: JSON.parse(n.payloadJson), payloadJson: undefined }));
}
export function markNotificationsSeen(db: DB, ctx: SessionCtx) {
  const ids = notificationsFor(db, ctx).filter((n) => !n.seenAt).map((n) => n.id);
  if (ids.length) db.update(s.notifications).set({ seenAt: nowIso() }).where(inArray(s.notifications.id, ids)).run();
  return { marked: ids.length };
}
export function auditTrail(db: Tx, f: { entityType?: string; agencyId?: string; limit?: number }) {
  const conds: any[] = [];
  if (f.entityType) conds.push(eq(s.auditEvents.entityType, f.entityType));
  if (f.agencyId) conds.push(eq(s.auditEvents.agencyId, f.agencyId));
  const users = Object.fromEntries(db.select().from(s.users).all().map((u) => [u.id, u.name]));
  return db.select().from(s.auditEvents).where(conds.length ? and(...conds) : undefined).orderBy(desc(s.auditEvents.occurredAt), desc(s.auditEvents.id)).limit(f.limit ?? 200).all().map((a) => ({ ...a, actorName: a.actorId ? users[a.actorId] ?? a.actorId : 'System', metadata: JSON.parse(a.metadataJson), metadataJson: undefined }));
}
export function demoStatus(db: Tx) {
  return { manifest: JSON.parse(getMeta(db, 'manifest') ?? '{}'), anchorUtc: getMeta(db, 'anchorUtc'), resetCount: Number(getMeta(db, 'resetCount') ?? 0), clockMode: process.env.DEMO_CLOCK_MODE ?? 'system', demoMode: process.env.DEMO_MODE ?? 'mock', resetEnabled: process.env.DEMO_RESET_ENABLED !== 'false' };
}
/** Atomic, authorisation-gated reset; validates the oracle afterwards when the anchor equals the current clock. */
export function resetDemo(db: DB, ctx: SessionCtx, confirm: string) {
  if (ctx.role !== 'SUPER_ADMIN') throw new AppError('FORBIDDEN', 'Only the seeded Super Admin can reset the demo');
  if (confirm !== 'RESET DEMO') throw new AppError('VALIDATION_ERROR', 'Type RESET DEMO to confirm');
  assertResetEnabled();
  assertDemoDbAllowed(dbFilePath());
  const count = Number(getMeta(db, 'resetCount') ?? 0) + 1;
  const anchor = anchorForSeed();
  seedDatabase(db, anchor, { preserveSessions: true, resetCount: count });
  const checks = validateSeededState(db, anchor);
  const failed = checks.filter((c) => !c.ok);
  audit(db, { userId: ctx.userId, role: ctx.role }, 'DEMO_RESET', 'demo', 'demo', null, { anchor, resetCount: count, failedChecks: failed.length });
  if (failed.length) throw new AppError('INVALID_STATE', `Reset completed but ${failed.length} oracle checks failed`, failed);
  return { anchorUtc: anchor, resetCount: count, checksPassed: checks.length, checks: checks.map((c) => c.name) };
}
