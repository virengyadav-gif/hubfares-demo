import { api, ok } from '@/server/http';
import { listAmendments, createAmendment, amendSchema } from '@/features/guided/service';
export const GET = api({ perm: ['AGENCY_VIEW', 'VIEW_ALL'] }, ({ db, ctx }) => ok(listAmendments(db, ctx), { guided: true }));
export const POST = api({ perm: 'AGENCY_AMEND', body: amendSchema }, ({ db, ctx, body }) => ok(createAmendment(db, ctx, body), { guided: true }, 201));
