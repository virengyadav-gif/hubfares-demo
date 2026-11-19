import { api } from '@/server/http';
export const GET = api({}, ({ ctx }) => ({ userId: ctx.userId, name: ctx.name, email: ctx.email, role: ctx.role, agencyId: ctx.agencyId, agencyName: ctx.agencyName, agencyStatus: ctx.agencyStatus, permissions: [...ctx.perms] }));
