import { api } from '@/server/http';
import { updateUser, updateUserSchema } from '@/features/agency-users/service';
export const PATCH = api({ perm: ['AGENCY_USERS_MANAGE', 'HUB_USERS_MANAGE'], body: updateUserSchema }, ({ db, ctx, params, body }) => updateUser(db, ctx, params.id, body));
