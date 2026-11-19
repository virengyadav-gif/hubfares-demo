import { z } from 'zod';
import { api, ok } from '@/server/http';
import { revalidateQuote } from '@/features/booking/service';
export const POST = api({ perm: 'AGENCY_BOOK', body: z.object({ scenario: z.enum(['reval_same', 'reval_change', 'reval_unavailable']).default('reval_same') }) }, ({ db, ctx, params, body }) => ok(revalidateQuote(db, ctx, params.id, body.scenario), { source: 'SIMULATED', provider: 'SABRE', scenario: body.scenario }));
