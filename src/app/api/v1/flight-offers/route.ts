import { api, ok } from '@/server/http';
import { searchFlights, searchSchema } from '@/features/search/service';
import { requireActiveAgency } from '@/server/auth/authorize';
export const GET = api({ perm: ['AGENCY_BOOK', 'AGENCY_VIEW'], query: searchSchema }, ({ db, ctx, query }) => { requireActiveAgency(ctx); return ok(searchFlights(db, ctx.agencyId!, query)); });
