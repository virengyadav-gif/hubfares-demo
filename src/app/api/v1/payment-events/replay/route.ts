import { z } from 'zod';
import { api, ok } from '@/server/http';
import { replayPaymentEvent } from '@/features/payments/service';
export const POST = api({ perm: 'PAYMENT_MATCH', body: z.object({ externalRef: z.string().min(4) }) }, ({ db, ctx, body }) => ok(replayPaymentEvent(db, ctx, body.externalRef), { source: 'SIMULATED' }));
