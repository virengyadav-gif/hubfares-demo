import { api } from '@/server/http';
import { upsertCoreRule, coreRuleSchema } from '@/features/commercials/service';
export const PATCH = api({ perm: 'COMMERCIAL_EDIT', body: coreRuleSchema }, ({ db, ctx, params, body }) => upsertCoreRule(db, ctx, params.id, body));
