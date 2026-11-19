import { api, ok } from '@/server/http';
import { catalog } from '@/features/reports/service';
export const GET = api({ perm: ['AGENCY_REPORTS', 'REPORTS_ALL'] }, ({ db, ctx }) => ok(catalog(db, ctx)));
