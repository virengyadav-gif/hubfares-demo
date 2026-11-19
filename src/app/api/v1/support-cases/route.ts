import { z } from 'zod';
import { api } from '@/server/http';
import { listCases } from '@/features/support-cases/service';
export const GET = api({ perm: ['AGENCY_SUPPORT', 'VIEW_ALL'], query: z.object({ agencyId: z.string().optional(), source: z.string().optional(), status: z.string().optional() }) }, ({ db, ctx, query }) => listCases(db, ctx, query));
