import { api, ok } from '@/server/http';
import { listCoreRules, upsertCoreRule, coreRuleSchema } from '@/features/commercials/service';
export const GET = api({ perm: 'VIEW_ALL' }, ({ db }) => listCoreRules(db));
export const POST = api({ perm: 'COMMERCIAL_EDIT', body: coreRuleSchema }, ({ db, ctx, body }) => ok(upsertCoreRule(db, ctx, null, body), {}, 201));
