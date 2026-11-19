import { api, ok } from '@/server/http';
import { guidedSamples } from '@/features/guided/service';
import { isHub } from '@/server/auth/authorize';
export const GET = api({}, ({ ctx }) => { const g = guidedSamples(); return ok({ ...g, heldCarts: g.heldCarts.filter((c: any) => isHub(ctx) || c.agencyId === ctx.agencyId) }, { guided: true }); });
