import { z } from 'zod';
import { publicApi } from '@/server/http';
import { statusByReference } from '@/features/onboarding/service';
export const POST = publicApi({ body: z.object({ reference: z.string().min(4), email: z.string().email() }) }, ({ db, body }) => statusByReference(db, body.reference, body.email));
