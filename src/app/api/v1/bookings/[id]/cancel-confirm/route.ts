import { api, ok } from '@/server/http';
import { confirmCancellation, cancelSchema } from '@/features/refunds/service';
export const POST = api({ perm: ['AGENCY_CANCEL', 'BOOKING_SERVICE_ALL'], body: cancelSchema, requireIdempotency: true }, ({ db, ctx, params, body, idemKey }) => { const r = confirmCancellation(db, ctx, params.id, body.mode, idemKey!, body.passengerIds); return ok(r.result, { source: 'SIMULATED', idempotentReplay: r.replay }); });
