import { z } from 'zod';
import { api } from '@/server/http';
import { walletSummary } from '@/features/payments/service';
export const GET = api({ perm: ['AGENCY_FINANCE_VIEW', 'VIEW_ALL'], query: z.object({ agencyId: z.string().optional() }) }, ({ db, ctx, query }) => walletSummary(db, ctx, query.agencyId));
