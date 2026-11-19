import { z } from 'zod';
import { api, ok } from '@/server/http';
import { advanceAmendment } from '@/features/guided/service';
export const PATCH = api({ perm: 'AMENDMENT_MANAGE', body: z.object({ reject: z.boolean().default(false) }) }, ({ db, ctx, params, body }) => ok(advanceAmendment(db, ctx, params.id, body.reject), { guided: true }));
