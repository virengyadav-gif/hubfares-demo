import { api } from '@/server/http';
import { demoStatus } from '@/features/guided/admin';
export const GET = api({}, ({ db }) => demoStatus(db));
