import { z } from 'zod';
import { api } from '@/server/http';
import { decideRevisedQuote } from '@/features/booking/service';
export const POST = api({ perm: 'AGENCY_BOOK', body: z.object({ accept: z.boolean() }) }, ({ db, ctx, params, body }) => decideRevisedQuote(db, ctx, params.id, body.accept));
