import { z } from 'zod';
import { publicApi, ok } from '@/server/http';
import { createApplication } from '@/features/onboarding/service';
export const POST = publicApi({ body: z.object({ draft: z.record(z.any()).default({}) }) }, ({ db, body }) => ok(createApplication(db, body.draft), {}, 201));
