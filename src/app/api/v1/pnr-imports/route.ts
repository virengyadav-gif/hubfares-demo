import { api, ok } from '@/server/http';
import { importPnr, lookupSchema } from '@/features/pnr-import/service';
export const POST = api({ perm: ['AGENCY_PNR_IMPORT', 'PNR_IMPORT_ANY'], body: lookupSchema, requireIdempotency: true }, ({ db, ctx, body, idemKey }) => { const r = importPnr(db, ctx, body, idemKey!); return ok(r.result, { source: 'SIMULATED', idempotentReplay: r.replay }, r.replay ? 200 : 201); });
