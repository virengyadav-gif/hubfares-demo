import { api, ok } from '@/server/http';
import { helpIntent, intentSchema } from '@/features/support-cases/service';
export const POST = api({ perm: 'AGENCY_SUPPORT', body: intentSchema }, ({ db, ctx, body }) => ok(helpIntent(db, ctx, body), { source: 'SEEDED', assistantMode: 'SCRIPTED' }));
