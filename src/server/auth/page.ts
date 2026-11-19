import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/server/db/client';
import { resolveSession, SESSION_COOKIE } from './session';
import { isHubRole } from './permissions';

export type ClientSession = { userId: string; name: string; email: string; role: string; agencyId: string | null; agencyName: string | null; agencyStatus: string | null; perms: string[]; isHub: boolean };
export async function pageSession(): Promise<ClientSession | null> {
  const c = await cookies();
  const ctx = resolveSession(getDb(), c.get(SESSION_COOKIE)?.value);
  if (!ctx) return null;
  return { userId: ctx.userId, name: ctx.name, email: ctx.email, role: ctx.role, agencyId: ctx.agencyId, agencyName: ctx.agencyName, agencyStatus: ctx.agencyStatus, perms: [...ctx.perms], isHub: isHubRole(ctx.role) };
}
export async function requireAgencySession(path: string) {
  const s = await pageSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (s.isHub) redirect('/operations');
  return s;
}
export async function requireHubSession(path: string) {
  const s = await pageSession();
  if (!s) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!s.isHub) redirect('/agency/search');
  return s;
}
