import { api, ok } from '@/server/http';
import { cancellationQuote, cancelSchema } from '@/features/refunds/service';
export const POST = api({ perm: ['AGENCY_CANCEL', 'BOOKING_SERVICE_ALL', 'AGENCY_VIEW', 'VIEW_ALL'], body: cancelSchema }, ({ db, ctx, params, body }) => ok(cancellationQuote(db, ctx, params.id, body.mode), { source: 'SIMULATED' }));
