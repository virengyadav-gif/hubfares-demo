/** Simplified Hubfares→OTA core commercial engine (Technical Design §4.3). Pure; no markup / advanced drafts. */
import { percentOfMinor } from '@/shared/money';

export type CoreRule = {
  id: string; label: string; agencyId: string | null; airlineCode: string | null; origin: string | null; destination: string | null;
  fixedFeeMinor: number; percentBps: number; disclosedServiceFeeMinor: number; rebateMinor: number;
  priority: number; enabled: boolean; effectiveFrom: string; effectiveUntil: string | null; ruleVersion: number;
};
export type PricingCtx = { agencyId: string; airlineCode: string; origin: string; destination: string; atIso: string };

/** Specificity rank: lower is more specific. Returns null if rule does not match the context. */
export function specificity(r: CoreRule, c: PricingCtx): number | null {
  if (r.agencyId && r.agencyId !== c.agencyId) return null;
  if (r.airlineCode && r.airlineCode !== c.airlineCode) return null;
  const hasRoute = !!(r.origin || r.destination);
  if (r.origin && r.origin !== c.origin) return null;
  if (r.destination && r.destination !== c.destination) return null;
  const a = !!r.agencyId, al = !!r.airlineCode;
  if (a && al && hasRoute) return 1;
  if (a && al) return 2;
  if (a && hasRoute) return 3;
  if (a) return 4;
  if (al || hasRoute) return 5;
  return 6;
}
export function selectCoreRule(rules: CoreRule[], c: PricingCtx): { rule: CoreRule; rank: number; rationale: string } {
  const t = Date.parse(c.atIso);
  const candidates = rules
    .filter((r) => r.enabled && Date.parse(r.effectiveFrom) <= t && (!r.effectiveUntil || Date.parse(r.effectiveUntil) > t))
    .map((r) => ({ r, rank: specificity(r, c) }))
    .filter((x): x is { r: CoreRule; rank: number } => x.rank !== null)
    .sort((x, y) => x.rank - y.rank || y.r.priority - x.r.priority || Date.parse(y.r.effectiveFrom) - Date.parse(x.r.effectiveFrom) || (x.r.id < y.r.id ? -1 : 1));
  if (!candidates.length) throw new Error('No applicable core commercial rule (global default missing)');
  const best = candidates[0];
  const names = ['', 'agency + airline + route', 'agency + airline', 'agency + route', 'agency default', 'global airline/route', 'global default'];
  return { rule: best.r, rank: best.rank, rationale: `Matched ${names[best.rank]} rule ${best.r.id} v${best.r.ruleVersion}` };
}
export type LegPrice = {
  supplierBaseMinor: number; supplierTaxMinor: number; fixedFeeMinor: number; percentFeeMinor: number;
  disclosedServiceFeeMinor: number; rebateMinor: number; priceAdjustmentMinor: number; legSellMinor: number; legSupplierCostMinor: number;
};
/** sell = base + tax + fixed + roundHalfUp(base × bps / 10 000) + disclosed service fee (+ revalidation adjustment). */
export function priceLeg(brand: { supplierBaseMinor: number; supplierTaxMinor: number }, rule: CoreRule, priceAdjustmentMinor = 0): LegPrice {
  const percentFeeMinor = percentOfMinor(brand.supplierBaseMinor, rule.percentBps);
  const supplierCost = brand.supplierBaseMinor + brand.supplierTaxMinor + priceAdjustmentMinor;
  const legSellMinor = supplierCost + rule.fixedFeeMinor + percentFeeMinor + rule.disclosedServiceFeeMinor;
  if (legSellMinor < 0) throw new Error('negative sell');
  return {
    supplierBaseMinor: brand.supplierBaseMinor, supplierTaxMinor: brand.supplierTaxMinor, fixedFeeMinor: rule.fixedFeeMinor,
    percentFeeMinor, disclosedServiceFeeMinor: rule.disclosedServiceFeeMinor, rebateMinor: rule.rebateMinor,
    priceAdjustmentMinor, legSellMinor, legSupplierCostMinor: supplierCost,
  };
}
