import { api } from '@/server/http';
import { getClaim } from '@/features/refunds/service';
export const GET = api({ perm: ['AGENCY_VIEW', 'VIEW_ALL'] }, ({ db, ctx, params }) => getClaim(db, ctx, params.id));
