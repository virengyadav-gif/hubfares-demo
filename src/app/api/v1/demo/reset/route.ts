import { z } from 'zod';
import { api } from '@/server/http';
import { resetDemo } from '@/features/guided/admin';
export const POST = api({ perm: 'DEMO_RESET', body: z.object({ confirm: z.string() }) }, ({ db, ctx, body }) => resetDemo(db, ctx, body.confirm));
