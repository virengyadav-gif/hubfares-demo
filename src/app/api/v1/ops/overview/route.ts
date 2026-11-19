import { api } from '@/server/http';
import { opsOverview } from '@/features/guided/admin';
export const GET = api({ perm: 'VIEW_ALL' }, ({ db }) => opsOverview(db));
