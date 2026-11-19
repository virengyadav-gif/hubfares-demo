import { api, ok } from '@/server/http';
import { searchFlights, searchSchema } from '@/features/search/service';
import { requireActiveAgency } from '@/server/auth/authorize';
export const GET = api({ perm: 'AGENCY_BOOK', query: searchSchema }, ({ db, ctx, query }) => { requireActiveAgency(ctx); return ok(searchFlights(db, ctx.agencyId!, query), { source: 'SIMULATED', provider: 'SABRE' }); });
