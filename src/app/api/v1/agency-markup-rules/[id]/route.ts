import { api, ok } from '@/server/http';
import { upsertMarkup, markupSchema } from '@/features/commercials/service';
export const PATCH = api({ perm: 'AGENCY_MARKUP_MANAGE', body: markupSchema }, ({ db, ctx, params, body }) => ok(upsertMarkup(db, ctx, params.id, body), { uiOnly: true }));
