/** Server-validated sessions: HTTP-only cookie holds a random token; DB stores only its SHA-256 hash. */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { DB } from '@/server/db/client';
import { users, sessions, agencies, userPermissions } from '@/server/db/schema';
import { sha256, audit } from '@/server/db/util';
import { nowIso, isoPlus, HOUR, nowMs } from '@/shared/time';
import { AppError } from '@/shared/errors';
import { effectivePerms, Perm, Role, isAgencyRole } from './permissions';

export const SESSION_COOKIE = 'hf_session';
export type SessionCtx = {
  sessionId: string; userId: string; name: string; email: string; role: Role; agencyId: string | null;
  agencyName: string | null; agencyStatus: string | null; perms: Set<Perm>;
};
export function verifyPassword(stored: string, password: string): boolean {
  const [alg, salt, hex] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hex) return false;
  const got = scryptSync(password, `hubfares:${salt}`, 32);
  const want = Buffer.from(hex, 'hex');
  return want.length === got.length && timingSafeEqual(got, want);
}
export function hashPassword(userId: string, password: string) {
  return `scrypt$${userId}$${scryptSync(password, `hubfares:${userId}`, 32).toString('hex')}`;
}
export function login(db: DB, email: string, password: string): { token: string; ctx: SessionCtx } {
  const u = db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get();
  if (!u || !verifyPassword(u.passwordHash, password)) throw new AppError('UNAUTHORIZED', 'Invalid demo credentials');
  if (u.status !== 'ACTIVE') throw new AppError('FORBIDDEN', 'This user account is inactive');
  if (u.agencyId) {
    const a = db.select().from(agencies).where(eq(agencies.id, u.agencyId)).get();
    if (!a || a.status === 'INACTIVE') throw new AppError('FORBIDDEN', 'This agency is not active');
  }
  const token = randomBytes(32).toString('hex');
  const id = `ses_${randomBytes(8).toString('hex')}`;
  db.insert(sessions).values({ id, userId: u.id, sessionHash: sha256(token), createdAt: nowIso(), expiresAt: isoPlus(nowIso(), 12 * HOUR) }).run();
  audit(db, { userId: u.id, role: u.role }, 'LOGIN', 'user', u.id, u.agencyId, {});
  return { token, ctx: resolveSession(db, token)! };
}
export function resolveSession(db: DB, token: string | null | undefined): SessionCtx | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const s = db.select().from(sessions).where(and(eq(sessions.sessionHash, sha256(token)), isNull(sessions.revokedAt))).get();
  if (!s || Date.parse(s.expiresAt) < nowMs()) return null;
  const u = db.select().from(users).where(eq(users.id, s.userId)).get();
  if (!u || u.status !== 'ACTIVE') return null;
  if (isAgencyRole(u.role) && !u.agencyId) return null;
  const a = u.agencyId ? db.select().from(agencies).where(eq(agencies.id, u.agencyId)).get() : null;
  const overrides = db.select().from(userPermissions).where(eq(userPermissions.userId, u.id)).all();
  return { sessionId: s.id, userId: u.id, name: u.name, email: u.email, role: u.role as Role, agencyId: u.agencyId, agencyName: a?.displayName ?? null, agencyStatus: a?.status ?? null, perms: effectivePerms(u.role as Role, overrides) };
}
export function logout(db: DB, ctx: SessionCtx) {
  db.update(sessions).set({ revokedAt: nowIso() }).where(eq(sessions.id, ctx.sessionId)).run();
}
export function tokenFromCookieHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === SESSION_COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}
