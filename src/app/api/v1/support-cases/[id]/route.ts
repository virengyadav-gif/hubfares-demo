import { api } from '@/server/http';
import { getCase, updateCase, caseUpdateSchema } from '@/features/support-cases/service';
export const GET = api({ perm: ['AGENCY_SUPPORT', 'VIEW_ALL'] }, ({ db, ctx, params }) => getCase(db, ctx, params.id));
export const PATCH = api({ perm: 'CASES_MANAGE', body: caseUpdateSchema }, ({ db, ctx, params, body }) => updateCase(db, ctx, params.id, body));
