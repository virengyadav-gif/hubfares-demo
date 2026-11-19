import { z } from 'zod';
import { api } from '@/server/http';
import { listClaims } from '@/features/refunds/service';
export const GET = api({ perm: ['AGENCY_VIEW', 'VIEW_ALL'], query: z.object({ agencyId: z.string().optional() }) }, ({ db, ctx, query }) => listClaims(db, ctx, query.agencyId));
