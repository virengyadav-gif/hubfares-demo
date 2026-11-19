import { api, ok } from '@/server/http';
import { lookupPnr, lookupSchema } from '@/features/pnr-import/service';
export const POST = api({ perm: ['AGENCY_PNR_IMPORT', 'PNR_IMPORT_ANY'], body: lookupSchema }, ({ db, ctx, body }) => ok(lookupPnr(db, ctx, body), { source: 'SIMULATED', provider: body.provider }));
