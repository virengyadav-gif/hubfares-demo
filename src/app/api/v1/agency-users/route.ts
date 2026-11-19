import { z } from 'zod';
import { api, ok } from '@/server/http';
import { listUsers, createAgencyUser, createUserSchema } from '@/features/agency-users/service';
export const GET = api({ perm: ['AGENCY_USERS_MANAGE', 'AGENCY_VIEW', 'VIEW_ALL'], query: z.object({ agencyId: z.string().optional(), hubOnly: z.string().optional() }) }, ({ db, ctx, query }) => listUsers(db, ctx, query.agencyId, query.hubOnly === '1'));
export const POST = api({ perm: ['AGENCY_USERS_MANAGE', 'HUB_USERS_MANAGE'], body: createUserSchema }, ({ db, ctx, body }) => ok(createAgencyUser(db, ctx, body), {}, 201));
