import { api, ok } from '@/server/http';
import { saveAdvanced, advancedSchema } from '@/features/commercials/service';
export const PATCH = api({ perm: 'ADVANCED_RULES', body: advancedSchema }, ({ db, ctx, params, body }) => ok(saveAdvanced(db, ctx, params.id, body), { guided: true }));
