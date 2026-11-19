import { z } from 'zod';
import { api } from '@/server/http';
import { auditTrail } from '@/features/guided/admin';
export const GET = api({ perm: ['POLICY_EDIT', 'HUB_USERS_MANAGE', 'APPLICATION_REVIEW'], query: z.object({ entityType: z.string().optional(), agencyId: z.string().optional() }) }, ({ db, query }) => auditTrail(db, query));
