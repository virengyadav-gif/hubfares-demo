import { z } from 'zod';
import { publicApi } from '@/server/http';
import { confirmExtraction } from '@/features/onboarding/service';
export const POST = publicApi({ body: z.object({ reviewed: z.record(z.string()) }) }, ({ db, params, body, req }) => confirmExtraction(db, params.id, req.headers.get('x-application-token') ?? '', params.docId, body.reviewed));
