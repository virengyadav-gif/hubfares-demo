import { z } from 'zod';
import { api } from '@/server/http';
import { listPolicies, publishPolicy } from '@/features/commercials/service';
export const GET = api({ perm: ['AGENCY_VIEW', 'VIEW_ALL'], query: z.object({ agencyId: z.string().optional() }) }, ({ db, ctx, query }) => listPolicies(db, ctx, query.agencyId));
export const PATCH = api({ perm: 'POLICY_EDIT', body: z.object({ agencyId: z.string(), type: z.enum(['CREDIT', 'REFUND']), config: z.any() }) }, ({ db, ctx, body }) => publishPolicy(db, ctx, body.agencyId, body.type, body.config));
