import { z } from 'zod';
import { publicApi, ApiResult } from '@/server/http';
import { login, SESSION_COOKIE } from '@/server/auth/session';
export const POST = publicApi({ body: z.object({ email: z.string().email(), password: z.string().min(1).max(100) }) }, ({ db, body }) => {
  const { token, ctx } = login(db, body.email, body.password);
  const secure = (process.env.APP_BASE_URL ?? '').startsWith('https') ? '; Secure' : '';
  return new ApiResult({ userId: ctx.userId, role: ctx.role, agencyId: ctx.agencyId, name: ctx.name }, {}, 200, { 'Set-Cookie': `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure}` });
});
