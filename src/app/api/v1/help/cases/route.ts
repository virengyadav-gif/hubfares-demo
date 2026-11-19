import { api, ok } from '@/server/http';
import { createHelpCase, helpCaseSchema } from '@/features/support-cases/service';
export const POST = api({ perm: 'AGENCY_SUPPORT', body: helpCaseSchema, requireIdempotency: true }, ({ db, ctx, body, idemKey }) => { const r = createHelpCase(db, ctx, body, idemKey!); return ok(r.result, { assistantMode: 'SCRIPTED', idempotentReplay: r.replay }, r.replay ? 200 : 201); });
