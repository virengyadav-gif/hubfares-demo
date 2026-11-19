import { api, ok } from '@/server/http';
import { createQuote, quoteSchema } from '@/features/booking/service';
export const POST = api({ perm: 'AGENCY_BOOK', body: quoteSchema }, ({ db, ctx, body }) => ok(createQuote(db, ctx, body), { source: 'SEEDED' }, 201));
