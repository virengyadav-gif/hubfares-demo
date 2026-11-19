import { api, ok } from '@/server/http';
import { payoutRefund } from '@/features/refunds/service';
export const POST = api({ perm: 'REFUND_PAYOUT', requireIdempotency: true }, ({ db, ctx, params, idemKey }) => { const r = payoutRefund(db, ctx, params.id, idemKey!); return ok(r.result, { idempotentReplay: r.replay }); });
