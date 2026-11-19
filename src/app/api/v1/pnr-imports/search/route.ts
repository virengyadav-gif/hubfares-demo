import { api, ok } from '@/server/http';
import { searchPnrs, searchSchema } from '@/features/pnr-import/service';
export const POST = api({ perm: ['AGENCY_PNR_IMPORT', 'PNR_IMPORT_ANY'], body: searchSchema }, ({ db, ctx, body }) => ok(searchPnrs(db, ctx, body)));
