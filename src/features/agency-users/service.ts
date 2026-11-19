/** Agency sub-users (WF-04) and Hubfares user administration (ADM-01). Server-side tenant enforcement. */
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { nextSeq, audit, Tx } from '@/server/db/util';
import type { SessionCtx } from '@/server/auth/session';
import { hashPassword } from '@/server/auth/session';
import { agencyScope, isHub, requirePerm } from '@/server/auth/authorize';
import { AppError, NEUTRAL_NOT_FOUND } from '@/shared/errors';
import { nowIso } from '@/shared/time';
import { DEMO_INITIAL_PASSWORD } from '@/features/onboarding/service';

export const createUserSchema = z.object({ name: z.string().trim().min(2).max(60), email: z.string().trim().toLowerCase().email().max(120), mobile: z.string().trim().regex(/^\+?[0-9]{10,13}$/), role: z.enum(['AGENCY_AGENT', 'AGENCY_FINANCE_VIEWER', 'AGENCY_ADMIN']), agencyId: z.string().optional(), permissions: z.object({ BOOK: z.boolean().default(true), CANCEL: z.boolean().default(true), FINANCE_VIEW: z.boolean().default(true) }).partial().default({}) });
export const updateUserSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']).optional(), role: z.enum(['AGENCY_AGENT', 'AGENCY_FINANCE_VIEWER', 'AGENCY_ADMIN', 'SUPER_ADMIN', 'HUB_ADMIN_FINANCE', 'HUB_OPS', 'HUB_CXO']).optional(), permissions: z.object({ BOOK: z.boolean(), CANCEL: z.boolean(), FINANCE_VIEW: z.boolean() }).partial().optional() });

export function listUsers(db: Tx, ctx: SessionCtx, agencyId?: string, hubOnly = false) {
  const scope = agencyScope(ctx, agencyId);
  let rows = db.select().from(s.users).where(scope ? eq(s.users.agencyId, scope) : undefined).all();
  if (hubOnly) rows = rows.filter((u) => !u.agencyId);
  const perms = db.select().from(s.userPermissions).all();
  const ag = Object.fromEntries(db.select().from(s.agencies).all().map((a) => [a.id, a.displayName]));
  return rows.map((u) => ({ id: u.id, name: u.name, email: u.email, mobile: u.mobile, role: u.role, status: u.status, agencyId: u.agencyId, agencyName: u.agencyId ? ag[u.agencyId] : 'Hubfares', createdAt: u.createdAt, permissions: Object.fromEntries(['BOOK', 'CANCEL', 'FINANCE_VIEW'].map((k) => [k, perms.find((p) => p.userId === u.id && p.permissionKey === k)?.allowed ?? true])) }));
}
export function createAgencyUser(db: DB, ctx: SessionCtx, input: z.infer<typeof createUserSchema>) {
  const agencyId = isHub(ctx) ? input.agencyId : ctx.agencyId;
  if (isHub(ctx)) requirePerm(ctx, 'HUB_USERS_MANAGE'); else requirePerm(ctx, 'AGENCY_USERS_MANAGE');
  if (!agencyId) throw new AppError('VALIDATION_ERROR', 'Agency is required');
  if (input.agencyId && !isHub(ctx) && input.agencyId !== ctx.agencyId) throw new AppError('FORBIDDEN', 'You can only create users in your own agency');
  return db.transaction((tx) => {
    const ag = tx.select().from(s.agencies).where(eq(s.agencies.id, agencyId)).get();
    if (!ag) throw new AppError('NOT_FOUND', 'Agency not found');
    if (ag.status !== 'ACTIVE') throw new AppError('AGENCY_INACTIVE', 'Agency is not active');
    if (tx.select().from(s.users).where(eq(s.users.email, input.email)).get()) throw new AppError('DUPLICATE_RECORD', 'A user with this email (login) already exists');
    const id = `user_${agencyId.replace('agency_', '')}_${nextSeq(tx, `user:${agencyId}`, 10)}`;
    tx.insert(s.users).values({ id, agencyId, name: input.name, email: input.email, mobile: input.mobile, role: input.role, status: 'ACTIVE', passwordHash: hashPassword(id, DEMO_INITIAL_PASSWORD), createdAt: nowIso() }).run();
    if (input.role === 'AGENCY_AGENT') for (const k of ['BOOK', 'CANCEL', 'FINANCE_VIEW'] as const) tx.insert(s.userPermissions).values({ id: `perm_${id}_${k}`, userId: id, permissionKey: k, allowed: input.permissions[k] ?? true }).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'USER_CREATED', 'user', id, agencyId, { role: input.role });
    return { id, agencyId, email: input.email, role: input.role, initialPassword: 'Default initial password' };
  });
}
export function updateUser(db: DB, ctx: SessionCtx, userId: string, input: z.infer<typeof updateUserSchema>) {
  return db.transaction((tx) => {
    const u = tx.select().from(s.users).where(eq(s.users.id, userId)).get();
    if (!u) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
    if (!isHub(ctx)) {
      requirePerm(ctx, 'AGENCY_USERS_MANAGE');
      if (u.agencyId !== ctx.agencyId) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
      if (input.role && !input.role.startsWith('AGENCY_')) throw new AppError('FORBIDDEN', 'Agency admins cannot grant Hubfares roles');
      if (u.id === ctx.userId && (input.status === 'INACTIVE' || (input.role && input.role !== 'AGENCY_ADMIN'))) throw new AppError('INVALID_STATE', 'You cannot deactivate or demote yourself');
    } else {
      requirePerm(ctx, 'HUB_USERS_MANAGE');
      if (input.role && u.agencyId && !input.role.startsWith('AGENCY_')) throw new AppError('FORBIDDEN', 'Agency users cannot receive Hubfares roles');
      if (input.role && !u.agencyId && input.role.startsWith('AGENCY_')) throw new AppError('FORBIDDEN', 'Hubfares users cannot receive agency roles');
      if (u.id === ctx.userId && input.status === 'INACTIVE') throw new AppError('INVALID_STATE', 'You cannot deactivate yourself');
    }
    const set: any = {};
    if (input.status) set.status = input.status;
    if (input.role) set.role = input.role;
    if (Object.keys(set).length) tx.update(s.users).set(set).where(eq(s.users.id, userId)).run();
    if (input.permissions) for (const [k, v] of Object.entries(input.permissions)) {
      tx.insert(s.userPermissions).values({ id: `perm_${userId}_${k}`, userId, permissionKey: k, allowed: !!v }).onConflictDoUpdate({ target: [s.userPermissions.userId, s.userPermissions.permissionKey], set: { allowed: !!v } }).run();
    }
    if (input.status === 'INACTIVE') tx.update(s.sessions).set({ revokedAt: nowIso() }).where(eq(s.sessions.userId, userId)).run();
    audit(tx, { userId: ctx.userId, role: ctx.role }, input.status === 'INACTIVE' ? 'USER_DEACTIVATED' : input.status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_UPDATED', 'user', userId, u.agencyId, input);
    return listUsers(tx, ctx, u.agencyId ?? undefined).find((x) => x.id === userId) ?? { id: userId };
  });
}
export { and };
