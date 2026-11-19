/** Fare-rule profile types and exact slab classification (Technical Design §4.2). */
export type ProfileId = 'A_FLEXIBLE' | 'B_RESTRICTED';
export type SlabId = 'S0' | 'S1' | 'S2';
export type CancelSlab = { id: SlabId; minLeadMs: number; maxLeadMsExclusive: number | null; nonRefundable: boolean; supplierPenaltyMinor: number | null; serviceFeeMinor: number };
export type ChangeSlab = { id: SlabId; permitted: boolean; supplierPenaltyMinor: number | null; fareDifferenceApplies: boolean };
export type FareRuleProfile = {
  id: ProfileId; version: number; currency: 'INR'; label: string;
  cancellationSlabs: CancelSlab[]; dateChangeSlabs: ChangeSlab[];
  noShow: { afterDeparture: 'NON_REFUNDABLE' }; seatFee: { mode: string; illustrativeOnly: boolean }; applicability: string;
};
export const PROFILE_IDS: ProfileId[] = ['A_FLEXIBLE', 'B_RESTRICTED'];
export const TWO_H = 7_200_000;
export const DAY_MS = 86_400_000;

export type SlabClass = SlabId | 'NO_SHOW';
/** remaining = departure − now (ms). departure ≤ now → NO_SHOW; (0,2h) → S0; [2h,24h) → S1; ≥24h → S2. */
export function classifySlab(departureIso: string, nowMs: number): SlabClass {
  const remaining = Date.parse(departureIso) - nowMs;
  if (remaining <= 0) return 'NO_SHOW';
  if (remaining < TWO_H) return 'S0';
  if (remaining < DAY_MS) return 'S1';
  return 'S2';
}
export const SLAB_LABEL: Record<SlabClass, string> = { S0: 'Less than 2 hours', S1: '2–24 hours', S2: '24 hours or more', NO_SHOW: 'After departure' };
export function cancelSlab(profile: FareRuleProfile, slab: SlabId): CancelSlab {
  const s = profile.cancellationSlabs.find((x) => x.id === slab);
  if (!s) throw new Error(`Profile ${profile.id} missing slab ${slab}`);
  return s;
}
