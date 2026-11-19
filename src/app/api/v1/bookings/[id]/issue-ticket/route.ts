import { api, ok } from '@/server/http';
import { issueTicket, ticketSchema } from '@/features/booking/service';
export const POST = api({ perm: ['AGENCY_BOOK', 'BOOKING_SERVICE_ALL'], body: ticketSchema, requireIdempotency: true }, ({ db, ctx, params, body, idemKey }) => { const r = issueTicket(db, ctx, params.id, body, idemKey!); return ok(r.result, { source: 'SIMULATED', provider: 'SABRE', idempotentReplay: r.replay }); });
