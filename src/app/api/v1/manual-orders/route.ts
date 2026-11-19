import { api, ok } from '@/server/http';
import { createManualOrder, manualOrderSchema } from '@/features/guided/service';
export const POST = api({ perm: 'MANUAL_ORDER', body: manualOrderSchema }, ({ db, ctx, body }) => ok(createManualOrder(db, ctx, body), { guided: true }, 201));
