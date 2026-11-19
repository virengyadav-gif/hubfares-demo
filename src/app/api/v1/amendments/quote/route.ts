import { api, ok } from '@/server/http';
import { amendmentQuote, amendSchema } from '@/features/guided/service';
export const POST = api({ perm: ['AGENCY_AMEND', 'AMENDMENT_MANAGE'], body: amendSchema }, ({ db, ctx, body }) => ok(amendmentQuote(db, ctx, body.bookingId, body.type, body.optionId), { guided: true }));
