import { z } from 'zod';
import { publicApi } from '@/server/http';
import { saveDraft, applicationStatus } from '@/features/onboarding/service';
const tok = (req: Request) => req.headers.get('x-application-token') ?? '';
export const GET = publicApi({}, ({ db, params, req }) => applicationStatus(db, params.id, tok(req)));
export const PATCH = publicApi({ body: z.object({ draft: z.record(z.any()) }) }, ({ db, params, body, req }) => saveDraft(db, params.id, tok(req), body.draft));
