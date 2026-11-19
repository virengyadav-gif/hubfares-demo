import { api, ok } from '@/server/http';
import { postSupplierSettlement, settlementSchema } from '@/features/refunds/service';
export const POST = api({ perm: 'SUPPLIER_SETTLE', body: settlementSchema, requireIdempotency: true }, ({ db, ctx, params, body, idemKey }) => { const r = postSupplierSettlement(db, ctx, params.id, body.scenarioId, idemKey!); return ok(r.result, { source: 'SIMULATED', guided: true, idempotentReplay: r.replay }); });
