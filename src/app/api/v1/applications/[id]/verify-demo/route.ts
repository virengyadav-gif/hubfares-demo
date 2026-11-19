import { api, ok } from '@/server/http';
import { runMockKyc, kycSchema } from '@/features/onboarding/service';
export const POST = api({ perm: 'KYC_VERIFY', body: kycSchema }, ({ db, ctx, params, body }) => ok(runMockKyc(db, ctx, params.id, body), { source: 'SIMULATED' }));
