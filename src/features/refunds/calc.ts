/** Full-itinerary cancellation estimate (Technical Design §4.7). Pure; per-segment slab from each booked snapshot. */
import { classifySlab, cancelSlab, FareRuleProfile, SlabClass, SLAB_LABEL } from '@/features/fares/rules';
import { clamp } from '@/shared/money';

export type BookedSegmentForCancel = {
  legIndex: number; origin: string; destination: string; departureAt: string;
  segmentSellMinor: number; segmentSupplierCostMinor: number; profile: FareRuleProfile; adults: number;
};
export type SegmentBreakdown = {
  legIndex: number; route: string; departureAt: string; slab: SlabClass; slabLabel: string; profileId: string; profileVersion: number;
  nonRefundable: boolean; refundableComponentsMinor: number; supplierPenaltyMinor: number; serviceFeeMinor: number;
  segmentRefundMinor: number; supplierExpectedMinor: number;
};
export type CancelQuote = {
  segments: SegmentBreakdown[]; refundableComponentsMinor: number; supplierPenaltyMinor: number; serviceFeeMinor: number;
  estimatedAgencyRefundMinor: number; supplierExpectedMinor: number; agencyAmountPaidMinor: number; allDeparted: boolean; anyDeparted: boolean;
};
export function computeCancellation(segments: BookedSegmentForCancel[], nowMs: number): CancelQuote {
  const out: SegmentBreakdown[] = segments.map((s) => {
    const slab = classifySlab(s.departureAt, nowMs);
    const base = { legIndex: s.legIndex, route: `${s.origin}-${s.destination}`, departureAt: s.departureAt, slab, slabLabel: SLAB_LABEL[slab], profileId: s.profile.id, profileVersion: s.profile.version };
    if (slab === 'NO_SHOW' || slab === 'S0') {
      // Non-refundable near departure / no-show: Phase 0 seed refunds zero eligible components for this segment.
      return { ...base, nonRefundable: true, refundableComponentsMinor: s.segmentSellMinor, supplierPenaltyMinor: 0, serviceFeeMinor: 0, segmentRefundMinor: 0, supplierExpectedMinor: 0 };
    }
    const cs = cancelSlab(s.profile, slab);
    const penalty = (cs.supplierPenaltyMinor ?? 0) * s.adults;
    const fee = cs.serviceFeeMinor * s.adults;
    return {
      ...base, nonRefundable: false, refundableComponentsMinor: s.segmentSellMinor, supplierPenaltyMinor: penalty, serviceFeeMinor: fee,
      segmentRefundMinor: clamp(s.segmentSellMinor - penalty - fee, 0, s.segmentSellMinor),
      supplierExpectedMinor: Math.max(0, s.segmentSupplierCostMinor - penalty),
    };
  });
  const paid = segments.reduce((a, s) => a + s.segmentSellMinor, 0);
  const refund = clamp(out.reduce((a, s) => a + s.segmentRefundMinor, 0), 0, paid);
  return {
    segments: out,
    refundableComponentsMinor: out.reduce((a, s) => a + (s.nonRefundable ? 0 : s.refundableComponentsMinor), 0),
    supplierPenaltyMinor: out.reduce((a, s) => a + s.supplierPenaltyMinor, 0),
    serviceFeeMinor: out.reduce((a, s) => a + s.serviceFeeMinor, 0),
    estimatedAgencyRefundMinor: refund,
    supplierExpectedMinor: out.reduce((a, s) => a + s.supplierExpectedMinor, 0),
    agencyAmountPaidMinor: paid,
    allDeparted: out.every((s) => s.slab === 'NO_SHOW'),
    anyDeparted: out.some((s) => s.slab === 'NO_SHOW'),
  };
}
