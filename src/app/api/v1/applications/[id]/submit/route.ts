import { z } from 'zod';
import { publicApi } from '@/server/http';
import { submitApplication } from '@/features/onboarding/service';
export const POST = publicApi({ body: z.object({ draft: z.any() }) }, ({ db, params, body, req }) => submitApplication(db, params.id, req.headers.get('x-application-token') ?? '', body.draft));
