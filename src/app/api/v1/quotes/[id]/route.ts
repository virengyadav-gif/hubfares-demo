import { api } from '@/server/http';
import { getQuote } from '@/features/booking/service';
export const GET = api({ perm: ['AGENCY_VIEW', 'VIEW_ALL'] }, ({ db, ctx, params }) => getQuote(db, ctx, params.id));
