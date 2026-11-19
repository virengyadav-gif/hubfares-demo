import { api, ok } from '@/server/http';
import { simulateTransfer, demoPaymentSchema } from '@/features/payments/service';
export const POST = api({ perm: 'AGENCY_PAYMENT_INIT', body: demoPaymentSchema, requireIdempotency: true }, ({ db, ctx, body, idemKey }) => ok(simulateTransfer(db, ctx, body.amountMinor, idemKey!), { source: 'SIMULATED', provider: 'DEMO_BANK' }, 201));
