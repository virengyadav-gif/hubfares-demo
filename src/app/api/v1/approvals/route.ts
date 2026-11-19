import { z } from 'zod';
import { api } from '@/server/http';
import { listApprovals } from '@/features/approvals/service';
export const GET = api({ perm: ['APPROVALS_DECIDE', 'POLICY_EDIT'], query: z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() }) }, ({ db, query }) => listApprovals(db, query.status));
