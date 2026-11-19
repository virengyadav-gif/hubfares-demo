import { api } from '@/server/http';
import { decideApplication, decisionSchema } from '@/features/onboarding/service';
export const POST = api({ perm: 'APPLICATION_REVIEW', body: decisionSchema }, ({ db, ctx, params, body }) => decideApplication(db, ctx, params.id, body));
