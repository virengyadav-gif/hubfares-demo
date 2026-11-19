import { eq } from 'drizzle-orm';
import { api } from '@/server/http';
import * as s from '@/server/db/schema';
import { assertOwned } from '@/server/auth/authorize';
import { fundingPosition } from '@/features/wallet-credit/position';
import { listPolicies } from '@/features/commercials/service';
import { listUsers } from '@/features/agency-users/service';
import { AppError, NEUTRAL_NOT_FOUND } from '@/shared/errors';
import { nowIso } from '@/shared/time';
export const GET = api({}, ({ db, ctx, params }) => {
  const a = db.select().from(s.agencies).where(eq(s.agencies.id, params.id)).get();
  if (!a) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
  assertOwned(ctx, a.id);
  return { ...a, position: fundingPosition(db, a.id, nowIso()), policies: listPolicies(db, ctx, a.id), users: listUsers(db, ctx, a.id) };
});
