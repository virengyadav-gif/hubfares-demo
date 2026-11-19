import { api, ok } from '@/server/http';
import { listAmendments, confirmDateChange, confirmDateChangeSchema } from '@/features/amendments/service';
export const GET = api({ perm: ['AGENCY_VIEW', 'VIEW_ALL'] }, ({ db, ctx }) => ok(listAmendments(db, ctx)));
export const POST = api({ perm: ['AGENCY_AMEND', 'AMENDMENT_MANAGE'], body: confirmDateChangeSchema, requireIdempotency: true }, ({ db, ctx, body, idemKey }) => { const r = confirmDateChange(db, ctx, body, idemKey!); return ok(r.result, { idempotentReplay: r.replay }, 201); });
