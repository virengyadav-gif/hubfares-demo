import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { api, ok } from '@/server/http';
import * as s from '@/server/db/schema';
import { audit } from '@/server/db/util';
import { AppError } from '@/shared/errors';
import { nowIso } from '@/shared/time';
const list = (db: any) => db.select().from(s.fxDemoRates).all().map((r: any) => ({ quoteCurrency: r.quoteCurrency, inrPerUnit: r.inrPerUnit, effectiveDate: r.effectiveDate, source: r.source }));
export const GET = api({}, ({ db }) => ok(list(db), { label: 'Exchange rates' }));
/** Manage Exchange: update a display rate (display conversion only — bookings, wallet and settlement stay in INR). */
export const PATCH = api({ perm: 'POLICY_EDIT', body: z.object({ quoteCurrency: z.enum(['USD', 'EUR']), inrPerUnit: z.string().regex(/^\d{1,4}(\.\d{1,4})?$/, 'Enter a rate such as 90 or 89.75') }) }, ({ db, ctx, body }) => {
  const r = db.select().from(s.fxDemoRates).where(eq(s.fxDemoRates.quoteCurrency, body.quoteCurrency)).get();
  if (!r) throw new AppError('NOT_FOUND', 'Currency not configured');
  if (Number(body.inrPerUnit) <= 0) throw new AppError('VALIDATION_ERROR', 'Rate must be greater than zero');
  const today = nowIso().slice(0, 10);
  db.update(s.fxDemoRates).set({ inrPerUnit: body.inrPerUnit, effectiveDate: today, source: 'MANUAL' }).where(eq(s.fxDemoRates.id, r.id)).run();
  audit(db, { userId: ctx.userId, role: ctx.role }, 'FX_RATE_UPDATED', 'fx_rate', r.id, null, { from: r.inrPerUnit, to: body.inrPerUnit });
  return ok(list(db));
});
