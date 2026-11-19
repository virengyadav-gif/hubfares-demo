import { api, ok } from '@/server/http';
import { matchPaymentEvent } from '@/features/payments/service';
export const POST = api({ perm: 'PAYMENT_MATCH', requireIdempotency: true }, ({ db, ctx, params, idemKey }) => { const r = matchPaymentEvent(db, ctx, params.id, idemKey!, `AUTO_MATCHER (triggered by ${ctx.name})`); return ok(r.result, { source: 'SIMULATED', idempotentReplay: r.replay }); });
