import { api, ok } from '@/server/http';
import { dateChangeQuote, dateChangeSchema } from '@/features/amendments/service';
export const POST = api({ perm: ['AGENCY_AMEND', 'AMENDMENT_MANAGE'], body: dateChangeSchema }, ({ db, ctx, body }) => ok(dateChangeQuote(db, ctx, body)));
