import { api } from '@/server/http';
import { passbook, passbookSchema } from '@/features/payments/service';
export const GET = api({ perm: ['AGENCY_FINANCE_VIEW', 'VIEW_ALL'], query: passbookSchema }, ({ db, ctx, query }) => passbook(db, ctx, query));
