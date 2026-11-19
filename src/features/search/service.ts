/** Sabre-mock flight search with core commercial pricing (WF-07). Read-only; no ledger effects. */
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { flightOffers, fareBrands, coreCommercialRules, fareRuleProfiles } from '@/server/db/schema';
import type { Tx } from '@/server/db/util';
import { selectCoreRule, priceLeg, CoreRule } from '@/features/commercials/pricing';
import { localYmd, addDaysYmd } from '@/shared/time/zones';
import { nowIso, nowMs } from '@/shared/time';
import { AppError } from '@/shared/errors';

export const CITY_TO_AIRPORTS: Record<string, string[]> = { LON: ['LHR'], GOA: ['GOI'], BOM: ['BOM'], DEL: ['DEL'], BLR: ['BLR'], SIN: ['SIN'], DXB: ['DXB'], FRA: ['FRA'], LHR: ['LHR'], GOI: ['GOI'] };
export const AIRPORT_LABELS: Record<string, string> = { BOM: 'Mumbai (BOM)', DEL: 'Delhi (DEL)', BLR: 'Bengaluru (BLR)', GOA: 'Goa (GOI)', LON: 'London (LHR)', SIN: 'Singapore (SIN)', DXB: 'Dubai (DXB)', FRA: 'Frankfurt (FRA)' };
export const searchSchema = z.object({
  tripType: z.enum(['ONE_WAY', 'ROUND_TRIP']).default('ONE_WAY'),
  origin: z.string().trim().toUpperCase().min(3).max(3), destination: z.string().trim().toUpperCase().min(3).max(3),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
  adults: z.coerce.number().int().min(0).max(9).default(1), children: z.coerce.number().int().min(0).max(9).default(0), infants: z.coerce.number().int().min(0).max(9).default(0),
  cabin: z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST', 'ANY']).default('ANY'), preferredAirline: z.string().trim().toUpperCase().optional(),
});
export type SearchInput = z.infer<typeof searchSchema>;

export function loadCoreRules(db: Tx): CoreRule[] {
  return db.select().from(coreCommercialRules).all().map((r) => ({ ...r, enabled: !!r.enabled }));
}
export function validateSearch(i: SearchInput) {
  const errs: Record<string, string> = {};
  if (!CITY_TO_AIRPORTS[i.origin]) errs.origin = 'This airport is not served yet';
  if (!CITY_TO_AIRPORTS[i.destination]) errs.destination = 'This airport is not served yet';
  if (i.origin === i.destination) errs.destination = 'Destination must differ from origin';
  if (i.adults + i.children < 1) errs.adults = 'At least one adult or child traveller is required';
  if (i.infants > i.adults) errs.infants = 'Each infant must travel with an adult';
  if (i.tripType === 'ROUND_TRIP') {
    if (!i.returnDate) errs.returnDate = 'Return date is required for a round trip';
    else if (i.returnDate < i.departureDate) errs.returnDate = 'Return cannot be before departure';
  }
  if (Object.keys(errs).length) throw new AppError('VALIDATION_ERROR', 'Please correct the search criteria', { fieldErrors: errs });
}
type PricedBrand = { id: string; brandCode: string; brandName: string; fareClass: string; refundableLabel: string; baggage: { cabin: string; checkIn: string }; meal: string | null; ruleProfileId: string; supplierBaseMinor: number; supplierTaxMinor: number; sellMinor: number; components: ReturnType<typeof priceLeg>; coreRuleId: string; coreRuleVersion: number; rationale: string };

export function priceBrandsForOffers(db: Tx, agencyId: string, offerIds: string[]) {
  const rules = loadCoreRules(db);
  const offers = offerIds.length ? db.select().from(flightOffers).where(inArray(flightOffers.id, offerIds)).all() : [];
  const brands = offerIds.length ? db.select().from(fareBrands).where(inArray(fareBrands.offerId, offerIds)).all() : [];
  const at = nowIso();
  return offers.map((o) => {
    const sel = selectCoreRule(rules, { agencyId, airlineCode: o.airlineCode, origin: o.origin, destination: o.destination, atIso: at });
    const priced: PricedBrand[] = brands.filter((b) => b.offerId === o.id).map((b) => {
      const comp = priceLeg(b, sel.rule);
      return { id: b.id, brandCode: b.brandCode, brandName: b.brandName, fareClass: b.fareClass, refundableLabel: b.refundableLabel, baggage: JSON.parse(b.baggageJson), meal: b.meal, ruleProfileId: b.ruleProfileId, supplierBaseMinor: b.supplierBaseMinor, supplierTaxMinor: b.supplierTaxMinor, sellMinor: comp.legSellMinor, components: comp, coreRuleId: sel.rule.id, coreRuleVersion: sel.rule.ruleVersion, rationale: sel.rationale };
    }).sort((a, b) => a.sellMinor - b.sellMinor);
    return { ...o, brands: priced, fromSellMinor: priced[0]?.sellMinor ?? null };
  });
}

function legSearch(db: Tx, agencyId: string, origin: string, destination: string, ymd: string, i: SearchInput) {
  const oAir = CITY_TO_AIRPORTS[origin], dAir = CITY_TO_AIRPORTS[destination];
  let offers = db.select().from(flightOffers).where(and(inArray(flightOffers.origin, oAir), inArray(flightOffers.destination, dAir))).all();
  if (i.cabin !== 'ANY') offers = offers.filter((o) => o.cabin === i.cabin);
  if (i.preferredAirline) offers = offers.filter((o) => o.airlineCode === i.preferredAirline);
  const now = nowMs();
  const live = offers.filter((o) => Date.parse(o.departureAt) > now);
  const sameDay = live.filter((o) => localYmd(o.departureAt, o.originTz) === ymd);
  const priced = priceBrandsForOffers(db, agencyId, live.map((o) => o.id));
  const strip = [-3, -2, -1, 0, 1, 2, 3].map((d) => {
    const day = addDaysYmd(ymd, d);
    const cands = priced.filter((o) => localYmd(o.departureAt, o.originTz) === day && o.seatsLeft > 0 && o.fromSellMinor !== null);
    return { date: day, cheapestSellMinor: cands.length ? Math.min(...cands.map((c) => c.fromSellMinor!)) : null };
  });
  const results = priced.filter((o) => sameDay.some((s) => s.id === o.id)).map((o) => ({ ...o, providerCode: undefined, soldOut: o.seatsLeft <= 0 }));
  return { results, dateStrip: strip };
}
export function searchFlights(db: Tx, agencyId: string, i: SearchInput) {
  validateSearch(i);
  const outbound = legSearch(db, agencyId, i.origin, i.destination, i.departureDate, i);
  const inbound = i.tripType === 'ROUND_TRIP' && i.returnDate ? legSearch(db, agencyId, i.destination, i.origin, i.returnDate, i) : null;
  const profiles = db.select().from(fareRuleProfiles).all().map((p) => JSON.parse(p.dataJson));
  return { criteria: i, outbound, inbound, profiles };
}
/** Suggested seeded dates per route so the operator always lands on inventory (relative to the reset anchor). */
export function seededDates(db: Tx) {
  const offers = db.select().from(flightOffers).all().filter((o) => Date.parse(o.departureAt) > nowMs());
  const m: Record<string, string[]> = {};
  for (const o of offers) {
    const k = `${o.searchOriginCity}-${o.searchDestinationCity}`;
    const d = localYmd(o.departureAt, o.originTz);
    (m[k] ??= []).includes(d) || m[k].push(d);
  }
  for (const k of Object.keys(m)) m[k].sort();
  return m;
}
export { fareRuleProfiles, eq };
