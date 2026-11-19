import { api } from '@/server/http';
import { applicationDetail } from '@/features/onboarding/service';
export const GET = api({ perm: ['APPLICATION_REVIEW', 'VIEW_ALL'] }, ({ db, params }) => applicationDetail(db, params.id));
