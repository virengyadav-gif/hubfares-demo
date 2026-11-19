import { describe, it, expect } from 'vitest';
import { classifySlab } from '@/features/fares/rules';
import { percentOfMinor } from '@/shared/money';
import { convertForDisplay, formatDisplay } from '@/shared/money/fx';
import { priceLeg, selectCoreRule, CoreRule } from '@/features/commercials/pricing';
import { computeCancellation } from '@/features/refunds/calc';
import fs from 'node:fs';

const profiles = JSON.parse(fs.readFileSync('fixtures/fare-rules.json', 'utf8'));
const A = profiles.find((p: any) => p.id === 'A_FLEXIBLE'); const B = profiles.find((p: any) => p.id === 'B_RESTRICTED');
const now = Date.parse('2026-11-19T12:00:00.000Z');
const at = (ms: number) => new Date(now + ms).toISOString();
const H = 3600000;

describe('Fare slabs & money (unit)', () => {
  it('TC-022 exact boundaries: 1:59:59→S0, 2:00:00→S1, 23:59:59→S1, 24:00:00→S2, now→NO_SHOW, -1m→NO_SHOW', () => {
    expect(classifySlab(at(2 * H - 1000), now)).toBe('S0');
    expect(classifySlab(at(2 * H), now)).toBe('S1');
    expect(classifySlab(at(24 * H - 1000), now)).toBe('S1');
    expect(classifySlab(at(24 * H), now)).toBe('S2');
    expect(classifySlab(at(0), now)).toBe('NO_SHOW');
    expect(classifySlab(at(-60000), now)).toBe('NO_SHOW');
  });
  it('percent fee uses integer round-half-up on supplier base', () => {
    expect(percentOfMinor(2550000, 150)).toBe(38250);
    expect(percentOfMinor(1, 5000)).toBe(1);
    expect(percentOfMinor(1, 4999)).toBe(0);
  });
  it('Technical Design §5.3 worked example 3,063,250 minor', () => {
    const rule: CoreRule = { id: 'core_sky_bom_lon', label: '', agencyId: 'agency_skyline', airlineCode: 'BA', origin: 'BOM', destination: 'LHR', fixedFeeMinor: 25000, percentBps: 150, disclosedServiceFeeMinor: 0, rebateMinor: 0, priority: 10, enabled: true, effectiveFrom: '2026-01-01T00:00:00Z', effectiveUntil: null, ruleVersion: 1 };
    expect(priceLeg({ supplierBaseMinor: 2550000, supplierTaxMinor: 450000 }, rule).legSellMinor).toBe(3063250);
  });
  it('core rule precedence: agency+airline+route beats agency default beats global', () => {
    const base = { label: '', disclosedServiceFeeMinor: 0, rebateMinor: 0, enabled: true, effectiveFrom: '2026-01-01T00:00:00Z', effectiveUntil: null, ruleVersion: 1, percentBps: 0 };
    const rules: CoreRule[] = [
      { ...base, id: 'g', agencyId: null, airlineCode: null, origin: null, destination: null, fixedFeeMinor: 1, priority: 0 },
      { ...base, id: 'ad', agencyId: 'a1', airlineCode: null, origin: null, destination: null, fixedFeeMinor: 2, priority: 5 },
      { ...base, id: 'aar', agencyId: 'a1', airlineCode: 'BA', origin: 'BOM', destination: 'LHR', fixedFeeMinor: 3, priority: 1 },
    ];
    const ctx = { agencyId: 'a1', airlineCode: 'BA', origin: 'BOM', destination: 'LHR', atIso: '2026-11-19T12:00:00Z' };
    expect(selectCoreRule(rules, ctx).rule.id).toBe('aar');
    expect(selectCoreRule(rules, { ...ctx, airlineCode: 'AI' }).rule.id).toBe('ad');
    expect(selectCoreRule(rules, { ...ctx, agencyId: 'zz' }).rule.id).toBe('g');
  });
  it('TC-032 FX display: INR 30,632.50 → $340.36 and €291.74 (display rounding only)', () => {
    expect(convertForDisplay(3063250, { quoteCurrency: 'USD', inrPerUnit: '90', effectiveDate: '2026-11-19', source: 'DEMO' })).toBe(34036);
    expect(convertForDisplay(3063250, { quoteCurrency: 'EUR', inrPerUnit: '105', effectiveDate: '2026-11-19', source: 'DEMO' })).toBe(29174);
    expect(formatDisplay(34036, 'USD')).toBe('$340.36');
  });
  it('TC-033 missing rate returns null (no invented rate)', () => {
    expect(convertForDisplay(3063250, null)).toBeNull();
  });
  it('TC-060 (calc) return B S2 + B S2 → refund INR 49,732.50; per-leg slabs independent', () => {
    const q = computeCancellation([
      { legIndex: 0, origin: 'BOM', destination: 'LHR', departureAt: at(10 * 24 * H), segmentSellMinor: 3063250, segmentSupplierCostMinor: 3000000, profile: B, adults: 1 },
      { legIndex: 1, origin: 'LHR', destination: 'BOM', departureAt: at(19 * 24 * H), segmentSellMinor: 2520000, segmentSupplierCostMinor: 2500000, profile: B, adults: 1 },
    ], now);
    expect(q.estimatedAgencyRefundMinor).toBe(4973250);
    expect(q.supplierPenaltyMinor).toBe(600000);
    expect(q.serviceFeeMinor).toBe(10000);
    const mixed = computeCancellation([
      { legIndex: 0, origin: 'BOM', destination: 'DEL', departureAt: at(3 * H), segmentSellMinor: 850000, segmentSupplierCostMinor: 795000, profile: A, adults: 1 },
      { legIndex: 1, origin: 'DEL', destination: 'BOM', departureAt: at(48 * H), segmentSellMinor: 850000, segmentSupplierCostMinor: 795000, profile: B, adults: 1 },
    ], now);
    expect(mixed.segments.map((s) => s.slab)).toEqual(['S1', 'S2']);
    expect(mixed.segments[0].supplierPenaltyMinor).toBe(199900);
    expect(mixed.segments[1].supplierPenaltyMinor).toBe(300000);
  });
  it('A S2 worked example: 8,500 − 1,047 − 50 = 7,403; supplier 7,950 − 1,047 = 6,903', () => {
    const q = computeCancellation([{ legIndex: 0, origin: 'BOM', destination: 'LHR', departureAt: at(12 * 24 * H), segmentSellMinor: 850000, segmentSupplierCostMinor: 795000, profile: A, adults: 1 }], now);
    expect(q.estimatedAgencyRefundMinor).toBe(740300);
    expect(q.supplierExpectedMinor).toBe(690300);
  });
});
