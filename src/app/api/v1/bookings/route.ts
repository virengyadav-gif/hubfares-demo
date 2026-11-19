import { api, ok } from '@/server/http';
import { createBooking, bookingSchema, listBookings, listSchema } from '@/features/booking/service';
export const GET = api({ perm: ['AGENCY_VIEW', 'VIEW_ALL'], query: listSchema }, ({ db, ctx, query }) => listBookings(db, ctx, query));
export const POST = api({ perm: 'AGENCY_BOOK', body: bookingSchema, requireIdempotency: true }, ({ db, ctx, body, idemKey }) => { const r = createBooking(db, ctx, body, idemKey!); return ok(r.result, { source: 'SIMULATED', provider: 'SABRE', idempotentReplay: r.replay }, r.replay ? 200 : 201); });
