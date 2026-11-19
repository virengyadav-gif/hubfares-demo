import { api } from '@/server/http';
import * as s from '@/server/db/schema';
import { fundingPosition } from '@/features/wallet-credit/position';
import { listPolicies } from '@/features/commercials/service';
import { nowIso } from '@/shared/time';
import { isHub } from '@/server/auth/authorize';
export const GET = api({}, ({ db, ctx }) => {
  const rows = db.select().from(s.agencies).all().filter((a) => isHub(ctx) || a.id === ctx.agencyId);
  const users = db.select().from(s.users).all(); const bks = db.select().from(s.bookings).all();
  return rows.map((a) => ({ ...a, users: users.filter((u) => u.agencyId === a.id).length, bookings: bks.filter((b) => b.agencyId === a.id).length, position: fundingPosition(db, a.id, nowIso()), policies: listPolicies(db, ctx, a.id).filter((p) => !p.effectiveUntil) }));
});
