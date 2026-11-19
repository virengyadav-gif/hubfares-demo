import { api } from '@/server/http';
import { listApplications } from '@/features/onboarding/service';
export const GET = api({ perm: ['APPLICATION_REVIEW', 'VIEW_ALL'] }, ({ db }) => listApplications(db));
