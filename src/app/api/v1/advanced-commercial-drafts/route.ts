import { api, ok } from '@/server/http';
import { listAdvanced, saveAdvanced, advancedSchema } from '@/features/commercials/service';
export const GET = api({ perm: ['ADVANCED_RULES', 'VIEW_ALL'] }, ({ db }) => ok(listAdvanced(db), { guided: true, evaluated: false }));
export const POST = api({ perm: 'ADVANCED_RULES', body: advancedSchema }, ({ db, ctx, body }) => ok(saveAdvanced(db, ctx, null, body), { guided: true }, 201));
