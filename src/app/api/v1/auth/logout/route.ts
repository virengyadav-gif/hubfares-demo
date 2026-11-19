import { api, ApiResult } from '@/server/http';
import { logout, SESSION_COOKIE } from '@/server/auth/session';
export const POST = api({}, ({ db, ctx }) => { logout(db, ctx); return new ApiResult({ ok: true }, {}, 200, { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` }); });
