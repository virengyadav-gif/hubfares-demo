import { api } from '@/server/http';
import { decideApproval, decisionSchema } from '@/features/approvals/service';
export const POST = api({ perm: 'APPROVALS_DECIDE', body: decisionSchema }, ({ db, ctx, params, body }) => decideApproval(db, ctx, params.id, body));
