import { api } from '@/server/http';
import { rejectPayment } from '@/features/payments/service';
export const POST = api({ perm: 'PAYMENT_MATCH' }, ({ db, ctx, params }) => rejectPayment(db, ctx, params.id));
