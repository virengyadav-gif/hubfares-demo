import { api } from '@/server/http';
import { notificationsFor, markNotificationsSeen } from '@/features/guided/admin';
export const GET = api({}, ({ db, ctx }) => notificationsFor(db, ctx));
export const POST = api({}, ({ db, ctx }) => markNotificationsSeen(db, ctx));
