import { api, ok } from '@/server/http';
import { recordCreditRepayment, repaySchema } from '@/features/payments/service';
export const POST = api({ perm: 'CREDIT_REPAY', body: repaySchema, requireIdempotency: true }, ({ db, ctx, body, idemKey }) => { const r = recordCreditRepayment(db, ctx, body, idemKey!); return ok(r.result, { source: 'SIMULATED', idempotentReplay: r.replay }); });
