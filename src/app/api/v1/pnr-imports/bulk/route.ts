import { api, ok } from '@/server/http';
import { bulkImport, bulkSchema } from '@/features/pnr-import/service';
export const POST = api({ perm: ['AGENCY_PNR_IMPORT', 'PNR_IMPORT_ANY'], body: bulkSchema, requireIdempotency: true }, ({ db, ctx, body, idemKey }) => ok(bulkImport(db, ctx, body, idemKey!)));
