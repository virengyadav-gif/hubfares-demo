import { api } from '@/server/http';
import { bookingDetail } from '@/features/booking/service';
export const GET = api({ perm: ['AGENCY_VIEW', 'VIEW_ALL'] }, ({ db, ctx, params }) => bookingDetail(db, ctx, params.id).segments);
