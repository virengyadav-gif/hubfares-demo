import { z } from 'zod';
import { api, ok } from '@/server/http';
import { overview, salesTrends, cancellations, creditRisk, operations, drilldownBookings } from '@/features/executive/service';
import { AppError } from '@/shared/errors';
const q = z.object({ from: z.string().optional(), to: z.string().optional(), agencyId: z.string().optional(), airline: z.string().optional(), route: z.string().optional(), journey: z.enum(['DOMESTIC', 'INTERNATIONAL']).optional(), status: z.string().optional() });
export const GET = api({ perm: 'EXEC_VIEW', query: q }, ({ db, params, query }) => {
  const f = Object.fromEntries(Object.entries(query).filter(([, v]) => v)) as any;
  const views: Record<string, () => unknown> = { overview: () => overview(db, f), 'ota-profitability': () => overview(db, f).byAgency, 'sales-trends': () => salesTrends(db, f), cancellations: () => cancellations(db, f), 'credit-risk': () => creditRisk(db), operations: () => operations(db), drilldown: () => drilldownBookings(db, f) };
  const v = views[params.view];
  if (!v) throw new AppError('NOT_FOUND', 'Unknown executive view');
  return ok(v(), { source: 'INTERNAL', dateBasis: 'booking date', illustrative: true });
});
