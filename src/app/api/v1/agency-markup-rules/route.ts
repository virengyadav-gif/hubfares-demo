import { api, ok } from '@/server/http';
import { listMarkup, upsertMarkup, markupSchema } from '@/features/commercials/service';
export const GET = api({ perm: ['AGENCY_MARKUP_VIEW', 'VIEW_ALL'] }, ({ db, ctx }) => ok(listMarkup(db, ctx), { uiOnly: true }));
export const POST = api({ perm: 'AGENCY_MARKUP_MANAGE', body: markupSchema }, ({ db, ctx, body }) => ok(upsertMarkup(db, ctx, null, body), { uiOnly: true }, 201));
