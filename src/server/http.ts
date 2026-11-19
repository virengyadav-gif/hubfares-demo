/** API route wrapper: auth, permission, Zod validation, same-origin CSRF guard, idempotency header, envelopes. */
import { ZodError, ZodTypeAny, z } from 'zod';
import { randomBytes } from 'node:crypto';
import { getDb, DB } from './db/client';
import { resolveSession, tokenFromCookieHeader, SessionCtx } from './auth/session';
import { requirePerm } from './auth/authorize';
import type { Perm } from './auth/permissions';
import { AppError } from '@/shared/errors';

type Ctx<B, Q> = { req: Request; db: DB; ctx: SessionCtx; body: B; query: Q; params: Record<string, string>; requestId: string; idemKey: string | null };
type PubCtx<B, Q> = Omit<Ctx<B, Q>, 'ctx'> & { ctx: SessionCtx | null };
type Opts<BS extends ZodTypeAny, QS extends ZodTypeAny> = { perm?: Perm | Perm[]; body?: BS; query?: QS; requireIdempotency?: boolean };
type Meta = { source?: 'SIMULATED' | 'SEEDED' | 'INTERNAL'; [k: string]: unknown };
export class ApiResult { constructor(public data: unknown, public meta: Meta = {}, public status = 200, public headers: Record<string, string> = {}, public raw?: BodyInit) {} }
export const ok = (data: unknown, meta: Meta = {}, status = 200) => new ApiResult(data, meta, status);
export const fileResponse = (body: Buffer, filename: string, mime: string) =>
  new ApiResult(null, {}, 200, { 'Content-Type': mime, 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' }, new Uint8Array(body));

function json(status: number, payload: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}
function sameOrigin(req: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser clients (tests/scripts) — cookie is SameSite=Lax
  try { return new URL(origin).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host')); } catch { return false; }
}
async function parseBody(req: Request) {
  if (['GET', 'HEAD'].includes(req.method)) return undefined;
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) { const t = await req.text(); return t ? JSON.parse(t) : {}; }
  return undefined;
}
function handleError(e: unknown, requestId: string) {
  if (e instanceof AppError) return json(e.status, { error: { code: e.code, message: e.message, details: e.details, requestId } });
  if (e instanceof ZodError) return json(422, { error: { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields', details: e.flatten(), requestId } });
  if (e instanceof SyntaxError) return json(400, { error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body', requestId } });
  console.error(`[${requestId}]`, e);
  return json(500, { error: { code: 'INTERNAL', message: 'Unexpected server error', requestId } });
}
function render(r: unknown, requestId: string) {
  if (r instanceof ApiResult) {
    if (r.raw !== undefined) return new Response(r.raw, { status: r.status, headers: r.headers });
    return json(r.status, { data: r.data, meta: { demo: true, source: 'INTERNAL', requestId, ...r.meta } }, r.headers);
  }
  return json(200, { data: r, meta: { demo: true, source: 'INTERNAL', requestId } });
}
async function common<BS extends ZodTypeAny, QS extends ZodTypeAny>(req: Request, rc: { params?: Promise<Record<string, string>> } | undefined, opts: Opts<BS, QS>, requireAuth = false) {
  const requestId = `req_${randomBytes(5).toString('hex')}`;
  if (!sameOrigin(req)) throw new AppError('FORBIDDEN', 'Cross-origin request rejected');
  const db = getDb();
  const ctx = resolveSession(db, tokenFromCookieHeader(req.headers.get('cookie')));
  if (requireAuth) {
    if (!ctx) throw new AppError('UNAUTHORIZED', 'Please sign in');
    if (opts.perm) requirePerm(ctx, ...(Array.isArray(opts.perm) ? opts.perm : [opts.perm]));
  }
  const url = new URL(req.url);
  const body = opts.body ? opts.body.parse((await parseBody(req)) ?? {}) : await parseBody(req).catch(() => undefined);
  const query = opts.query ? opts.query.parse(Object.fromEntries(url.searchParams)) : Object.fromEntries(url.searchParams);
  const params = rc?.params ? await rc.params : {};
  const idemKey = req.headers.get('idempotency-key');
  if (opts.requireIdempotency && (!idemKey || idemKey.length < 8 || idemKey.length > 128)) throw new AppError('VALIDATION_ERROR', 'Idempotency-Key header (8–128 chars) is required for this financial action');
  return { requestId, db, ctx, body, query, params, idemKey };
}
export function api<BS extends ZodTypeAny = z.ZodAny, QS extends ZodTypeAny = z.ZodAny>(opts: Opts<BS, QS>, fn: (c: Ctx<z.infer<BS>, z.infer<QS>>) => unknown | Promise<unknown>) {
  return async (req: Request, rc?: { params?: Promise<Record<string, string>> }) => {
    let requestId = 'req_unknown';
    try {
      const c = await common(req, rc, opts, true);
      requestId = c.requestId;
      return render(await fn({ ...c, ctx: c.ctx!, req }), c.requestId);
    } catch (e) { return handleError(e, requestId); }
  };
}
export function publicApi<BS extends ZodTypeAny = z.ZodAny, QS extends ZodTypeAny = z.ZodAny>(opts: Opts<BS, QS>, fn: (c: PubCtx<z.infer<BS>, z.infer<QS>>) => unknown | Promise<unknown>) {
  return async (req: Request, rc?: { params?: Promise<Record<string, string>> }) => {
    let requestId = 'req_unknown';
    try {
      const c = await common(req, rc, opts);
      requestId = c.requestId;
      return render(await fn({ ...c, req }), c.requestId);
    } catch (e) { return handleError(e, requestId); }
  };
}
