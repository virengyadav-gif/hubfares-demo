import { api, ok } from '@/server/http';
import { resolveUnmatched, resolveSchema } from '@/features/payments/service';
export const POST = api({ perm: 'PAYMENT_MATCH', body: resolveSchema, requireIdempotency: true }, ({ db, ctx, params, body, idemKey }) => ok(resolveUnmatched(db, ctx, params.id, body, idemKey!), { source: 'SIMULATED' }));
