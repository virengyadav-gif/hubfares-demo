import { api, ok } from '@/server/http';
import { catalog } from '@/features/reports/service';
export const GET = api({ perm: ['AGENCY_REPORTS', 'REPORTS_ALL'] }, ({ ctx }) => ok(catalog(ctx), { source: 'SEEDED', static: true }));
