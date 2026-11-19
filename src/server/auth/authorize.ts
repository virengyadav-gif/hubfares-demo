import { AppError, NEUTRAL_NOT_FOUND } from '@/shared/errors';
import type { SessionCtx } from './session';
import type { Perm } from './permissions';
import { isHubRole } from './permissions';

export function requirePerm(ctx: SessionCtx, ...perms: Perm[]) {
  if (!perms.some((p) => ctx.perms.has(p))) throw new AppError('FORBIDDEN', 'Your role is not permitted to perform this action');
}
/** OTA users are ALWAYS scoped to their session agency (any requested id is ignored); hub users may filter. */
export function agencyScope(ctx: SessionCtx, requested?: string | null): string | undefined {
  if (isHubRole(ctx.role)) return requested || undefined;
  return ctx.agencyId!;
}
/** Assert a tenant-owned record is visible; neutral 404 for cross-tenant access. */
export function assertOwned(ctx: SessionCtx, recordAgencyId: string | null | undefined) {
  if (isHubRole(ctx.role)) return;
  if (!recordAgencyId || recordAgencyId !== ctx.agencyId) throw new AppError('TENANT_RESOURCE_NOT_FOUND', NEUTRAL_NOT_FOUND);
}
export function requireActiveAgency(ctx: SessionCtx) {
  if (ctx.agencyId && ctx.agencyStatus !== 'ACTIVE') throw new AppError('AGENCY_INACTIVE', 'Your agency is not active — new bookings are blocked. Prior records remain viewable.');
}
export const isHub = (ctx: SessionCtx) => isHubRole(ctx.role);
