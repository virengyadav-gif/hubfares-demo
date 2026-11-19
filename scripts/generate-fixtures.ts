/**
 * One-time authoring tool: writes the canonical fixture pack from docs/03_DEMO_DATA_AND_MOCKS.md
 * and fixtures/seed-contract.v1.json. Output is committed; seed/reset read the JSON, not this script.
 * Deterministic: no Math.random, no Date.now. Run: npm run fixtures:generate
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { scryptSync } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const FX = path.resolve('fixtures');
const write = (name: string, data: unknown) => fs.writeFileSync(path.join(FX, name), JSON.stringify(data, null, 2) + '\n');
const contract = JSON.parse(fs.readFileSync(path.join(FX, 'seed-contract.v1.json'), 'utf8'));

export const DEMO_PASSWORD = 'Hubfares@Demo2026';
const hash = (userId: string) => `scrypt$${userId}$${scryptSync(DEMO_PASSWORD, `hubfares:${userId}`, 32).toString('hex')}`;

// ---------- agencies, application, providers ----------
write('agencies.json', {
  agencies: [
    { id: 'agency_skyline', legalName: 'Skyline Travels Private Limited', displayName: 'Skyline Travels', status: 'ACTIVE', city: 'Mumbai', state: 'Maharashtra', panMasked: 'AAKCS••01S', gstin: '27AAKCS0001S1Z5', contactEmail: 'ops@skyline.example.com', registeredOffset: 'D-120', activatedOffset: 'D-118', paymentReference: 'HFVA-SKY-001', funding: 'PREPAID', story: 'Onboarding, prepaid booking, supplier-pending refund' },
    { id: 'agency_orbit', legalName: 'Orbit Corporate Travel LLP', displayName: 'Orbit Corporate Travel', status: 'ACTIVE', city: 'Bengaluru', state: 'Karnataka', panMasked: 'AAGFO••01O', gstin: '29AAGFO0001O1Z2', contactEmail: 'finance@orbit.example.com', registeredOffset: 'D-100', activatedOffset: 'D-97', paymentReference: 'HFVA-ORB-001', funding: 'WEEKLY_CREDIT', story: 'Credit booking and prompt refund payout' },
    { id: 'agency_aster', legalName: 'Aster Holidays', displayName: 'Aster Holidays', status: 'ACTIVE', city: 'New Delhi', state: 'Delhi', panMasked: 'AAPFA••01A', gstin: '07AAPFA0001A1Z9', contactEmail: 'accounts@aster.example.com', registeredOffset: 'D-90', activatedOffset: 'D-88', paymentReference: 'HFVA-AST-001', funding: 'DAILY_CREDIT', story: 'High-cancellation / risk dashboard' },
  ],
  applications: [
    {
      id: 'APP0042', reference: 'HF-APP-0042', status: 'SUBMITTED', submittedOffset: 'H-26', createdOffset: 'D-2',
      draft: {
        organization: { agencyName: 'New Partner Travel', turnoverInr: 45000000, entityType: 'PRIVATE_LIMITED', pan: 'AAKCN0001N', gstin: '27AAKCN0001N1Z3', registrationNumber: 'U63040MH2019PTC000042', website: 'https://newpartner.example.com' },
        director: { salutation: 'Ms', firstName: 'Ananya', lastName: 'Deshpande', email: 'ananya@newpartner.example.com', mobile: '+919000000042' },
        finance: { salutation: 'Mr', firstName: 'Rohan', lastName: 'Iyer', email: 'finance@newpartner.example.com', mobile: '+919000000043' },
        communication: { email: 'hello@newpartner.example.com', mobile: '+919000000044', website: 'https://newpartner.example.com' },
        address: { line1: '12 Riverside Business Park', line2: 'Baner Road', country: 'India', state: 'Maharashtra', city: 'Pune', postalCode: '411045' },
        acknowledged: true,
      },
      documents: [{ id: 'doc_seed_np_1', docType: 'BUSINESS_REGISTRATION', originalName: 'sample-company-registration.pdf', fixtureFile: 'sample-company-registration.pdf' }],
    },
  ],
  providers: [
    { id: 'prov_sabre', providerCode: 'SABRE', providerKind: 'GDS', status: 'AVAILABLE', mode: 'MOCK' },
    { id: 'prov_travelport', providerCode: 'TRAVELPORT', providerKind: 'GDS', status: 'PLANNED', mode: 'UNAVAILABLE' },
    { id: 'prov_amadeus', providerCode: 'AMADEUS', providerKind: 'GDS', status: 'PLANNED', mode: 'UNAVAILABLE' },
  ],
  pccMappings: [
    { id: 'pcc_hfdemo1', providerId: 'prov_sabre', pccCode: 'H7FA', agencyId: null, enabled: true, description: 'Hubfares and permitted Skyline/Orbit/Aster operations' },
    { id: 'pcc_skydemo', providerId: 'prov_sabre', pccCode: 'S9KY', agencyId: 'agency_skyline', enabled: true, description: 'Skyline-only import scenario' },
    { id: 'pcc_orbdemo', providerId: 'prov_sabre', pccCode: 'O4RB', agencyId: 'agency_orbit', enabled: true, description: 'Orbit-only import scenario' },
    { id: 'pcc_tpdemo1', providerId: 'prov_travelport', pccCode: 'T1PA', agencyId: null, enabled: false, description: 'Future Travelport adapter — no live connection' },
    { id: 'pcc_amdemo1', providerId: 'prov_amadeus', pccCode: 'A1MA', agencyId: null, enabled: false, description: 'Future Amadeus adapter — no live connection' },
  ],
  suppliers: [
    { id: 'supplier_sabre_mock', name: 'Airline settlements (BSP)', demoCode: 'SUP-SABRE', status: 'ACTIVE' },
    { id: 'supplier_consolidator_a', name: 'Consolidator A', demoCode: 'SUP-CONA', status: 'ACTIVE' },
    { id: 'supplier_consolidator_b', name: 'Consolidator B', demoCode: 'SUP-CONB', status: 'ACTIVE' },
  ],
});

// ---------- users ----------
const u = (id: string, role: string, agencyId: string | null, name: string, email: string, mobile: string, permissions?: Record<string, boolean>) =>
  ({ id, role, agencyId, name, email, mobile, status: 'ACTIVE', passwordHash: hash(id), permissions: permissions ?? {} });
write('users.json', {
  credentialNote: 'Seeded hashed demo credentials (scrypt). Operator password is documented in README §Operator access only.',
  users: [
    u('user_super_admin', 'SUPER_ADMIN', null, 'Meera Kapoor', 'superadmin@hubfares.example.com', '+919100000001'),
    u('user_hub_finance', 'HUB_ADMIN_FINANCE', null, 'Vikram Shah', 'finance@hubfares.example.com', '+919100000002'),
    u('user_hub_ops', 'HUB_OPS', null, 'Neha Joshi', 'ops@hubfares.example.com', '+919100000003'),
    u('user_hub_cxo', 'HUB_CXO', null, 'Arjun Malhotra', 'cxo@hubfares.example.com', '+919100000004'),
    u('user_sky_admin', 'AGENCY_ADMIN', 'agency_skyline', 'Priya Nair', 'admin@skyline.example.com', '+919200000001'),
    u('user_sky_agent', 'AGENCY_AGENT', 'agency_skyline', 'Rahul Verma', 'agent@skyline.example.com', '+919200000002', { BOOK: true, CANCEL: true, FINANCE_VIEW: true }),
    u('user_orb_admin', 'AGENCY_ADMIN', 'agency_orbit', 'Sanjay Rao', 'admin@orbit.example.com', '+919300000001'),
    u('user_orb_agent', 'AGENCY_AGENT', 'agency_orbit', 'Divya Menon', 'agent@orbit.example.com', '+919300000002', { BOOK: true, CANCEL: true, FINANCE_VIEW: false }),
    u('user_ast_admin', 'AGENCY_ADMIN', 'agency_aster', 'Karan Bedi', 'admin@aster.example.com', '+919400000001'),
    u('user_ast_finance', 'AGENCY_FINANCE_VIEWER', 'agency_aster', 'Isha Gupta', 'finance@aster.example.com', '+919400000002'),
  ],
});

// ---------- policies ----------
write('policies.json', {
  policies: [
    { id: 'credit_sky_v1', agencyId: 'agency_skyline', type: 'CREDIT', version: 1, effectiveOffset: 'D-60', config: { cycle: 'UPFRONT', termDays: 0, creditEnabled: false, creditLimitMinor: 0, blockOnOverdue: false, allowWalletWhenCreditBlocked: true } },
    { id: 'credit_orb_v1', agencyId: 'agency_orbit', type: 'CREDIT', version: 1, effectiveOffset: 'D-60', config: { cycle: 'WEEKLY', termDays: 7, creditEnabled: true, creditLimitMinor: 20000000, blockOnOverdue: true, allowWalletWhenCreditBlocked: true } },
    { id: 'credit_ast_v1', agencyId: 'agency_aster', type: 'CREDIT', version: 1, effectiveOffset: 'D-60', effectiveUntilOffset: 'D-1', config: { cycle: 'DAILY', termDays: 1, creditEnabled: true, creditLimitMinor: 5000000, blockOnOverdue: false, allowWalletWhenCreditBlocked: true } },
    { id: 'credit_ast_v2', agencyId: 'agency_aster', type: 'CREDIT', version: 2, effectiveOffset: 'D-1', config: { cycle: 'DAILY', termDays: 1, creditEnabled: true, creditLimitMinor: 5000000, blockOnOverdue: true, allowWalletWhenCreditBlocked: true } },
    { id: 'refund_sky_v1', agencyId: 'agency_skyline', type: 'REFUND', version: 1, effectiveOffset: 'D-60', config: { payoutMode: 'SUPPLIER_SETTLEMENT', autoApproveLimitMinor: 10000000 } },
    { id: 'refund_orb_v1', agencyId: 'agency_orbit', type: 'REFUND', version: 1, effectiveOffset: 'D-60', config: { payoutMode: 'IMMEDIATE_IF_ELIGIBLE', autoApproveLimitMinor: 10000000 } },
    { id: 'refund_ast_v1', agencyId: 'agency_aster', type: 'REFUND', version: 1, effectiveOffset: 'D-60', config: { payoutMode: 'SUPPLIER_SETTLEMENT', autoApproveLimitMinor: 10000000 } },
  ],
  defaultsForNewAgency: {
    CREDIT: { cycle: 'UPFRONT', termDays: 0, creditEnabled: false, creditLimitMinor: 0, blockOnOverdue: true, allowWalletWhenCreditBlocked: true },
    REFUND: { payoutMode: 'SUPPLIER_SETTLEMENT', autoApproveLimitMinor: 10000000 },
  },
});

// ---------- fare rules (exact, Data & Mocks §5) ----------
const slabsCancel = (s1: number, s2: number) => [
  { id: 'S0', minLeadMs: 0, maxLeadMsExclusive: 7200000, nonRefundable: true, supplierPenaltyMinor: null, serviceFeeMinor: 0 },
  { id: 'S1', minLeadMs: 7200000, maxLeadMsExclusive: 86400000, nonRefundable: false, supplierPenaltyMinor: s1, serviceFeeMinor: 5000 },
  { id: 'S2', minLeadMs: 86400000, maxLeadMsExclusive: null, nonRefundable: false, supplierPenaltyMinor: s2, serviceFeeMinor: 5000 },
];
const slabsChange = (s1: number, s2: number) => [
  { id: 'S0', permitted: false, supplierPenaltyMinor: null, fareDifferenceApplies: false },
  { id: 'S1', permitted: true, supplierPenaltyMinor: s1, fareDifferenceApplies: true },
  { id: 'S2', permitted: true, supplierPenaltyMinor: s2, fareDifferenceApplies: true },
];
write('fare-rules.json', [
  { id: 'A_FLEXIBLE', version: 1, currency: 'INR', label: 'Flexible', cancellationSlabs: slabsCancel(199900, 104700), dateChangeSlabs: slabsChange(250000, 150000), noShow: { afterDeparture: 'NON_REFUNDABLE' }, seatFee: { mode: 'INDICATIVE', standardFromMinor: 0, preferredFromMinor: 40000, extraLegroomFromMinor: 90000, note: 'Standard seats free on Flexible fares; final price depends on airline, aircraft and seat.' }, ancillaries: { excessBaggagePerKgMinor: 50000, mealFromMinor: 0, nameChange: 'Not permitted', infantFareNote: 'Infant and child fares on request' }, applicability: 'PER_ADULT_PER_SECTOR' },
  { id: 'B_RESTRICTED', version: 1, currency: 'INR', label: 'Restricted', cancellationSlabs: slabsCancel(500000, 300000), dateChangeSlabs: slabsChange(350000, 200000), noShow: { afterDeparture: 'NON_REFUNDABLE' }, seatFee: { mode: 'INDICATIVE', standardFromMinor: 25000, preferredFromMinor: 60000, extraLegroomFromMinor: 120000, note: 'Seat selection is chargeable on Restricted fares; final price depends on airline, aircraft and seat.' }, ancillaries: { excessBaggagePerKgMinor: 55000, mealFromMinor: 30000, nameChange: 'Not permitted', infantFareNote: 'Infant and child fares on request' }, applicability: 'PER_ADULT_PER_SECTOR' },
]);

// ---------- airports & flights ----------
const AIRPORTS: Record<string, { city: string; cityCode: string; tz: string; country: string }> = {
  BOM: { city: 'Mumbai', cityCode: 'BOM', tz: 'Asia/Kolkata', country: 'IN' },
  DEL: { city: 'Delhi', cityCode: 'DEL', tz: 'Asia/Kolkata', country: 'IN' },
  BLR: { city: 'Bengaluru', cityCode: 'BLR', tz: 'Asia/Kolkata', country: 'IN' },
  GOI: { city: 'Goa', cityCode: 'GOA', tz: 'Asia/Kolkata', country: 'IN' },
  LHR: { city: 'London', cityCode: 'LON', tz: 'Europe/London', country: 'GB' },
  SIN: { city: 'Singapore', cityCode: 'SIN', tz: 'Asia/Singapore', country: 'SG' },
  DXB: { city: 'Dubai', cityCode: 'DXB', tz: 'Asia/Dubai', country: 'AE' },
  FRA: { city: 'Frankfurt', cityCode: 'FRA', tz: 'Europe/Berlin', country: 'DE' },
};
const AIRLINES: Record<string, string> = { AI: 'Air India', '6E': 'IndiGo', BA: 'British Airways', QR: 'Qatar Airways', EK: 'Emirates', SQ: 'Singapore Airlines', LH: 'Lufthansa' };
type B = [code: string, profile: 'A_FLEXIBLE' | 'B_RESTRICTED', baseInr: number, taxInr: number];
const BRAND_META: Record<string, { name: string; cls: string; label: string; bag: { cabin: string; checkIn: string }; meal: string }> = {
  SAVER: { name: 'Saver', cls: 'L', label: 'Conditionally refundable', bag: { cabin: '7 kg', checkIn: '15 kg' }, meal: 'Paid meal' },
  STANDARD: { name: 'Standard', cls: 'M', label: 'Refundable with fee', bag: { cabin: '7 kg', checkIn: '20 kg' }, meal: 'Free meal' },
  FLEX: { name: 'Flex', cls: 'Y', label: 'Refundable with fee', bag: { cabin: '7 kg', checkIn: '25 kg' }, meal: 'Free meal' },
  BUSINESS: { name: 'Business', cls: 'J', label: 'Refundable with fee', bag: { cabin: '2 × 7 kg', checkIn: '35 kg' }, meal: 'Gourmet meal' },
  BUSINESSFLEX: { name: 'Business Flex', cls: 'C', label: 'Refundable with fee', bag: { cabin: '2 × 7 kg', checkIn: '40 kg' }, meal: 'Gourmet meal' },
};
type O = { n: number; from: string; to: string; al: string; day: number; time: string; dur: number; stops: number; via?: string; cabin: string; brands: B[]; seats?: number; aircraft: string };
const OFFERS: O[] = [
  { n: 1, from: 'BOM', to: 'DEL', al: 'AI', day: 4, time: '07:00', dur: 130, stops: 0, cabin: 'ECONOMY', aircraft: 'A320neo', brands: [['SAVER', 'B_RESTRICTED', 5200, 950], ['STANDARD', 'A_FLEXIBLE', 5900, 950], ['FLEX', 'A_FLEXIBLE', 6800, 950]] },
  { n: 2, from: 'BOM', to: 'DEL', al: '6E', day: 4, time: '09:30', dur: 135, stops: 0, cabin: 'ECONOMY', aircraft: 'A321neo', brands: [['SAVER', 'B_RESTRICTED', 4700, 900], ['FLEX', 'A_FLEXIBLE', 5600, 900]] },
  { n: 3, from: 'BOM', to: 'DEL', al: 'AI', day: 5, time: '08:00', dur: 125, stops: 0, cabin: 'BUSINESS', aircraft: 'A350-900', brands: [['BUSINESS', 'A_FLEXIBLE', 21000, 2400]] },
  { n: 4, from: 'DEL', to: 'BOM', al: 'AI', day: 5, time: '18:00', dur: 130, stops: 0, cabin: 'ECONOMY', aircraft: 'A320neo', brands: [['SAVER', 'B_RESTRICTED', 5100, 950], ['STANDARD', 'B_RESTRICTED', 5700, 950]] },
  { n: 5, from: 'BOM', to: 'LHR', al: 'BA', day: 10, time: '02:00', dur: 600, stops: 0, cabin: 'ECONOMY', aircraft: 'B787-9', brands: [['SAVER', 'B_RESTRICTED', 25500, 4500], ['FLEX', 'A_FLEXIBLE', 29500, 4500]] },
  { n: 6, from: 'BOM', to: 'LHR', al: 'QR', day: 10, time: '04:00', dur: 780, stops: 1, via: 'DOH', cabin: 'ECONOMY', aircraft: 'B777-300ER', brands: [['SAVER', 'B_RESTRICTED', 22800, 4300], ['STANDARD', 'A_FLEXIBLE', 24900, 4300], ['FLEX', 'A_FLEXIBLE', 27600, 4300]] },
  { n: 7, from: 'BOM', to: 'LHR', al: 'EK', day: 11, time: '04:30', dur: 800, stops: 1, via: 'DXB', cabin: 'BUSINESS', aircraft: 'A380-800', brands: [['BUSINESS', 'A_FLEXIBLE', 88000, 9500], ['BUSINESSFLEX', 'A_FLEXIBLE', 96000, 9500]] },
  { n: 8, from: 'LHR', to: 'BOM', al: 'BA', day: 19, time: '20:00', dur: 560, stops: 0, cabin: 'ECONOMY', aircraft: 'B787-9', brands: [['SAVER', 'B_RESTRICTED', 21000, 4000], ['FLEX', 'A_FLEXIBLE', 24500, 4000]] },
  { n: 9, from: 'BOM', to: 'SIN', al: 'SQ', day: 8, time: '23:30', dur: 330, stops: 0, cabin: 'ECONOMY', aircraft: 'A350-900', brands: [['SAVER', 'B_RESTRICTED', 14200, 2600], ['FLEX', 'A_FLEXIBLE', 16400, 2600]] },
  { n: 10, from: 'SIN', to: 'BOM', al: 'SQ', day: 13, time: '19:00', dur: 340, stops: 0, cabin: 'ECONOMY', aircraft: 'A350-900', brands: [['SAVER', 'B_RESTRICTED', 13800, 2600], ['FLEX', 'A_FLEXIBLE', 15900, 2600]] },
  { n: 11, from: 'DEL', to: 'DXB', al: 'EK', day: 12, time: '09:00', dur: 230, stops: 0, cabin: 'ECONOMY', aircraft: 'B777-300ER', brands: [['SAVER', 'B_RESTRICTED', 11500, 2100], ['STANDARD', 'A_FLEXIBLE', 12900, 2100], ['FLEX', 'A_FLEXIBLE', 14300, 2100]] },
  { n: 12, from: 'DXB', to: 'DEL', al: 'EK', day: 18, time: '22:00', dur: 210, stops: 0, cabin: 'ECONOMY', aircraft: 'B777-300ER', brands: [['SAVER', 'B_RESTRICTED', 11200, 2100], ['FLEX', 'A_FLEXIBLE', 13600, 2100]] },
  { n: 13, from: 'BLR', to: 'DEL', al: '6E', day: 3, time: '06:15', dur: 165, stops: 0, cabin: 'ECONOMY', aircraft: 'A320neo', brands: [['SAVER', 'B_RESTRICTED', 4900, 900], ['FLEX', 'A_FLEXIBLE', 5800, 900]] },
  { n: 14, from: 'DEL', to: 'BLR', al: 'AI', day: 6, time: '13:00', dur: 170, stops: 0, cabin: 'ECONOMY', aircraft: 'A321neo', brands: [['SAVER', 'B_RESTRICTED', 5300, 950], ['STANDARD', 'A_FLEXIBLE', 6100, 950]] },
  { n: 15, from: 'BOM', to: 'GOI', al: '6E', day: 2, time: '10:45', dur: 75, stops: 0, cabin: 'ECONOMY', aircraft: 'ATR 72', brands: [['SAVER', 'B_RESTRICTED', 2900, 650], ['FLEX', 'A_FLEXIBLE', 3500, 650]] },
  { n: 16, from: 'GOI', to: 'BOM', al: '6E', day: 5, time: '16:30', dur: 80, stops: 0, cabin: 'ECONOMY', aircraft: 'ATR 72', seats: 0, brands: [['SAVER', 'B_RESTRICTED', 2800, 650]] },
  { n: 17, from: 'BOM', to: 'FRA', al: 'LH', day: 14, time: '02:30', dur: 560, stops: 0, cabin: 'ECONOMY', aircraft: 'B747-8', brands: [['SAVER', 'B_RESTRICTED', 27400, 5100], ['STANDARD', 'A_FLEXIBLE', 29900, 5100], ['FLEX', 'A_FLEXIBLE', 33500, 5100]] },
  { n: 18, from: 'FRA', to: 'BOM', al: 'LH', day: 22, time: '21:00', dur: 520, stops: 0, cabin: 'ECONOMY', aircraft: 'B747-8', brands: [['SAVER', 'B_RESTRICTED', 26800, 5100], ['FLEX', 'A_FLEXIBLE', 32400, 5100]] },
  { n: 19, from: 'DEL', to: 'LHR', al: 'BA', day: 16, time: '11:00', dur: 690, stops: 1, via: 'DOH', cabin: 'ECONOMY', aircraft: 'B787-8', brands: [['SAVER', 'B_RESTRICTED', 26200, 4800], ['FLEX', 'A_FLEXIBLE', 30800, 4800]] },
  { n: 20, from: 'BOM', to: 'LHR', al: 'AI', day: 10, time: '13:30', dur: 610, stops: 0, cabin: 'ECONOMY', aircraft: 'B777-300ER', brands: [['SAVER', 'B_RESTRICTED', 24600, 4500], ['STANDARD', 'B_RESTRICTED', 26000, 4500]] },
];
const p3 = (n: number) => String(n).padStart(3, '0');
write('flights.json', {
  note: 'Synthetic offers; not real airline inventory. Departure = anchor date (origin-local) + dayOffset at localTime. Prices are supplier components in paise.',
  airports: AIRPORTS,
  airlines: AIRLINES,
  offers: OFFERS.map((o) => ({
    id: `offer_${p3(o.n)}`, providerCode: 'SABRE', airlineCode: o.al, airlineName: AIRLINES[o.al], operatingCarrier: o.al,
    flightNumber: `${o.al} ${100 + o.n}`, origin: o.from, destination: o.to,
    searchOriginCity: AIRPORTS[o.from].cityCode, searchDestinationCity: AIRPORTS[o.to].cityCode,
    dayOffset: o.day, localDepartureTime: o.time, durationMin: o.dur, cabin: o.cabin, stops: o.stops, via: o.via ?? null,
    seatsLeft: o.seats ?? (3 + (o.n * 7) % 9), aircraft: o.aircraft,
    international: AIRPORTS[o.from].country !== 'IN' || AIRPORTS[o.to].country !== 'IN',
    brands: o.brands.map(([code, profile, base, tax]) => ({
      id: `brand_${p3(o.n)}_${code.toLowerCase()}`, brandCode: code, brandName: BRAND_META[code].name, fareClass: BRAND_META[code].cls,
      supplierBaseMinor: base * 100, supplierTaxMinor: tax * 100, ruleProfileId: profile,
      refundableLabel: BRAND_META[code].label, baggage: BRAND_META[code].bag, meal: BRAND_META[code].meal,
    })),
  })),
});

// ---------- commercials, markup UI, advanced drafts ----------
write('core-commercial-rules.json', [
  { id: 'core_global_default', label: 'Global default', agencyId: null, airlineCode: null, origin: null, destination: null, fixedFeeMinor: 20000, percentBps: 0, disclosedServiceFeeMinor: 0, rebateMinor: 0, priority: 0, enabled: true, effectiveOffset: 'D-90', ruleVersion: 1 },
  { id: 'core_sky_bom_del', label: 'Skyline · AI · BOM-DEL', agencyId: 'agency_skyline', airlineCode: 'AI', origin: 'BOM', destination: 'DEL', fixedFeeMinor: 7500, percentBps: 100, disclosedServiceFeeMinor: 0, rebateMinor: 0, priority: 10, enabled: true, effectiveOffset: 'D-90', ruleVersion: 1 },
  { id: 'core_sky_bom_lon', label: 'Skyline · BA · BOM-LON', agencyId: 'agency_skyline', airlineCode: 'BA', origin: 'BOM', destination: 'LHR', fixedFeeMinor: 25000, percentBps: 150, disclosedServiceFeeMinor: 0, rebateMinor: 0, priority: 10, enabled: true, effectiveOffset: 'D-90', ruleVersion: 1 },
  { id: 'core_orb_default', label: 'Orbit · agency default', agencyId: 'agency_orbit', airlineCode: null, origin: null, destination: null, fixedFeeMinor: 15000, percentBps: 50, disclosedServiceFeeMinor: 0, rebateMinor: 0, priority: 5, enabled: true, effectiveOffset: 'D-90', ruleVersion: 1 },
  { id: 'core_ast_default', label: 'Aster · agency default', agencyId: 'agency_aster', airlineCode: null, origin: null, destination: null, fixedFeeMinor: 5000, percentBps: 25, disclosedServiceFeeMinor: 0, rebateMinor: 0, priority: 5, enabled: true, effectiveOffset: 'D-90', ruleVersion: 1 },
]);
write('downstream-markup-ui.json', [
  { id: 'markup_sky_dom', agencyId: 'agency_skyline', name: 'Domestic resale markup', journey: 'DOMESTIC', tripTypes: ['ONE_WAY', 'RETURN'], airlineFilter: 'ALL', cabinFilter: 'ALL', markupKind: 'FIXED', value: 5000, currency: 'INR', targetUserIds: [], enabled: true },
  { id: 'markup_sky_int', agencyId: 'agency_skyline', name: 'International resale markup', journey: 'INTERNATIONAL', tripTypes: ['ONE_WAY', 'RETURN'], airlineFilter: 'ALL', cabinFilter: 'ALL', markupKind: 'FIXED', value: 10000, currency: 'INR', targetUserIds: [], enabled: true },
  { id: 'markup_orb_multi', agencyId: 'agency_orbit', name: 'Multi-city business uplift', journey: 'BOTH', tripTypes: ['MULTI_CITY'], airlineFilter: 'ALL', cabinFilter: 'BUSINESS', markupKind: 'PERCENT', value: 150, currency: null, targetUserIds: [], enabled: true },
]);
write('advanced-commercial-drafts.json', [
  {
    id: 'adv_demo_airline_sector', ruleName: 'BA long-haul sector incentive (draft)', priority: 100339, enabled: true, draftRevision: 3,
    header: { description: 'BA_BOM-LON_Sector_Incentive', searchType: 'ALL', airType: 'INTERNATIONAL', airline: 'BA' },
    criteria: {
      travelPeriod: { include: 'D+1 to D+180', exclude: '' }, bookingPeriod: { include: 'D-7 to D+60', exclude: '' },
      flightNumbers: { include: '', exclude: '' }, supplierIds: { include: 'supplier_sabre_mock', exclude: '' },
      sector: { include: 'BOM-LHR,LHR-BOM', exclude: '' }, destination: { include: 'GB', exclude: '' },
      marketingCarrier: { include: 'BA', exclude: '' }, operatingCarrier: { include: 'BA', exclude: '' },
      fareBasis: { include: '', exclude: '' }, bookingClass: { include: 'L,Y', exclude: '' }, privateAccountCodes: { include: '', exclude: '' },
      userIds: { include: '', exclude: '' }, paxTypes: { include: 'ADULT,CHILD', exclude: '' }, priceRange: { include: '0-500000', exclude: '' },
      cabin: { include: 'ECONOMY', exclude: '' }, weekdays: { include: 'MON,TUE,WED,THU,FRI,SAT,SUN', exclude: '' },
    },
    lines: [
      { type: 'IATA_COMMISSION', expression: '5*BF', applicableOnBooking: false, applicableOnInfant: false, applicableOnAllSegments: true },
      { type: 'MARKUP', expression: '1*TF', applicableOnBooking: true, applicableOnInfant: true, applicableOnAllSegments: false },
    ],
    history: [
      { revision: 1, at: 'D-20', by: 'user_hub_finance', note: 'Draft created' },
      { revision: 2, at: 'D-12', by: 'user_hub_finance', note: 'Added sector inclusion BOM-LHR,LHR-BOM' },
      { revision: 3, at: 'D-5', by: 'user_hub_finance', note: 'Added 1*TF markup line (not executed)' },
    ],
  },
  {
    id: 'adv_demo_fixed_markup', ruleName: 'Domestic fixed service fee (draft)', priority: 100120, enabled: false, draftRevision: 2,
    header: { description: 'DOM_Fixed_Markup_Weekend_Excl', searchType: 'ALL', airType: 'DOMESTIC', airline: 'ALL' },
    criteria: {
      travelPeriod: { include: '', exclude: '' }, bookingPeriod: { include: '', exclude: '' }, flightNumbers: { include: '', exclude: '' },
      supplierIds: { include: '', exclude: '' }, sector: { include: '', exclude: 'BOM-GOI,GOI-BOM' }, destination: { include: 'IN', exclude: '' },
      marketingCarrier: { include: '', exclude: '' }, operatingCarrier: { include: '', exclude: '' }, fareBasis: { include: '', exclude: '' },
      bookingClass: { include: '', exclude: '' }, privateAccountCodes: { include: '', exclude: '' }, userIds: { include: '', exclude: '' },
      paxTypes: { include: 'ADULT,CHILD,INFANT', exclude: '' }, priceRange: { include: '', exclude: '' },
      cabin: { include: 'ECONOMY,PREMIUM_ECONOMY', exclude: '' }, weekdays: { include: '', exclude: 'SAT,SUN' },
    },
    lines: [
      { type: 'MARKUP', expression: '270', applicableOnBooking: false, applicableOnInfant: true, applicableOnAllSegments: true },
      { type: 'SERVICE_FEE', expression: '180', applicableOnBooking: true, applicableOnInfant: true, applicableOnAllSegments: false },
    ],
    history: [
      { revision: 1, at: 'D-15', by: 'user_hub_finance', note: 'Draft created' },
      { revision: 2, at: 'D-3', by: 'user_super_admin', note: 'Excluded weekend travel and Goa sectors' },
    ],
  },
]);

// ---------- FX ----------
write('fx-rates.json', { baseCurrency: 'INR', effectiveDate: '2026-11-19', source: 'DEMO', rates: [
  { quoteCurrency: 'INR', inrPerUnit: '1' }, { quoteCurrency: 'USD', inrPerUnit: '90' }, { quoteCurrency: 'EUR', inrPerUnit: '105' },
] });

// ---------- historical bookings (enrich seed contract with routes/pax) ----------
const ROUTES: Record<string, [string, string, string, string]> = {
  // bookingId: [origin, destination, airline, brandCode]
  HFB1001: ['BOM', 'LHR', 'BA', 'FLEX'], HFB1002: ['BOM', 'DEL', 'AI', 'SAVER'], HFB1003: ['BOM', 'DEL', '6E', 'FLEX'],
  HFB1004: ['BOM', 'GOI', '6E', 'SAVER'], HFB1005: ['BOM', 'SIN', 'SQ', 'FLEX'], HFB1006: ['DEL', 'DXB', 'EK', 'SAVER'],
  HFB1007: ['BLR', 'DEL', '6E', 'FLEX'], HFB1008: ['BOM', 'DEL', 'AI', 'STANDARD'], HFB1009: ['DEL', 'BLR', 'AI', 'SAVER'],
  HFB1010: ['BOM', 'DEL', 'AI', 'FLEX'], HFB1011: ['BOM', 'DEL', 'AI', 'SAVER'], HFB1012: ['BOM', 'SIN', 'SQ', 'FLEX'],
  HFB1013: ['BOM', 'LHR', 'QR', 'SAVER'], HFB1014: ['DEL', 'BOM', 'AI', 'STANDARD'], HFB1015: ['BOM', 'FRA', 'LH', 'SAVER'],
  HFB1016: ['DEL', 'DXB', 'EK', 'FLEX'], HFB1017: ['BOM', 'GOI', '6E', 'SAVER'], HFB1018: ['DEL', 'BLR', 'AI', 'SAVER'],
  HFB1019: ['BOM', 'GOI', '6E', 'SAVER'], HFB1020: ['BLR', 'DEL', '6E', 'FLEX'], HFB1021: ['GOI', 'BOM', '6E', 'FLEX'],
  HFB1022: ['BOM', 'DEL', '6E', 'SAVER'], HFB1023: ['DEL', 'BOM', 'AI', 'STANDARD'], HFB1024: ['BOM', 'GOI', '6E', 'SAVER'],
  HFB1025: ['BOM', 'SIN', 'SQ', 'FLEX'], HFB1026: ['DEL', 'DXB', 'EK', 'STANDARD'], HFB1027: ['BOM', 'FRA', 'LH', 'STANDARD'], HFB1028: ['BOM', 'SIN', 'SQ', 'SAVER'],
};
const DUR: Record<string, number> = { 'BOM-LHR': 600, 'BOM-DEL': 130, 'BOM-GOI': 75, 'BOM-SIN': 330, 'DEL-DXB': 230, 'BLR-DEL': 165, 'DEL-BLR': 170, 'DEL-BOM': 130, 'BOM-FRA': 560, 'GOI-BOM': 80 };
const PAX = ['Aarav Mehta', 'Diya Sharma', 'Kabir Singh', 'Anika Reddy', 'Vihaan Patel', 'Saanvi Iyer', 'Arjun Das', 'Myra Kulkarni', 'Reyansh Bose', 'Kiara Menon', 'Ishaan Gill', 'Tara Pillai', 'Advait Rao', 'Navya Joshi', 'Atharv Jain', 'Aadhya Nair', 'Dhruv Chawla', 'Pari Saxena', 'Rudra Bhat', 'Ira Banerjee', 'Shaurya Malik', 'Meher Kohli', 'Vivaan Ghosh', 'Riya Dutta'];
// Multi-passenger bookings (PNR split / partial cancellation demonstrations)
const MULTI_PAX: Record<string, string[]> = {
  HFB1025: ['Mr Rohan Kapoor', 'Ms Sneha Kapoor'],
  HFB1026: ['Mr Amit Khanna', 'Ms Pooja Khanna', 'Mr Kunal Khanna'],
  HFB1027: ['Mr Varun Shetty', 'Ms Lakshmi Shetty'],
  HFB1028: ['Ms Farah Qureshi', 'Mr Imran Qureshi'],
};
write('bookings.json', {
  note: 'Generated from seed-contract.v1.json — amounts, statuses, offsets and policy snapshots are copied verbatim; routes/airlines/passengers are fixture assignments with no money effect.',
  bookings: contract.historicalBookings.map((b: any, i: number) => {
    const [o, d, al, brand] = ROUTES[b.id];
    return { ...b, origin: o, destination: d, airlineCode: al, airlineName: AIRLINES[al], flightNumber: `${al} ${700 + i + 1}`,
      brandCode: brand, cabin: 'ECONOMY', durationMin: DUR[`${o}-${d}`], passengerName: MULTI_PAX[b.id]?.[0] ?? `${PAX[i]}`, passengerNames: MULTI_PAX[b.id] ?? [`${PAX[i]}`],
      originTz: AIRPORTS[o].tz, destinationTz: AIRPORTS[d].tz };
  }),
});

// ---------- refunds & supplier receipts ----------
write('refunds.json', {
  claims: contract.historicalRefundClaims,
  supplierReceiptScenarios: [
    ...contract.supplierReceiptScenarios.map((s: any) => ({ ...s, supplierId: 'supplier_sabre_mock' })),
    { id: 'settle_orb_012', refundClaimId: 'RFD1012', externalRef: 'SUPRF-17553-001', amountMinor: 1755300, initiallyPosted: false, expectedState: 'MATCHED_NO_NEW_WALLET_CREDIT', supplierId: 'supplier_sabre_mock', note: 'Data & Mocks §9.4 supplier_event_orb_012_receive (full expected amount)' },
  ],
  deferred: [{ id: 'supplier_event_sky_003_short', reason: 'Underpayment amount not specified in Data & Mocks §9.4 — not invented; mismatch path demonstrated via settle_orb_mismatch_012.' }],
});

// ---------- payments ----------
write('payments.json', {
  bankProvider: 'BANK_VA',
  events: [
    { id: 'pay_sky_match_001', agencyHint: 'HFVA-SKY-001', externalRef: 'UTR26111001', amountMinor: 2500000, currency: 'INR', receivedOffset: 'H-3', expectedStatus: 'RECEIVED' },
    { id: 'pay_orb_match_001', agencyHint: 'HFVA-ORB-001', externalRef: 'UTR26112001', amountMinor: 4000000, currency: 'INR', receivedOffset: 'H-2', expectedStatus: 'RECEIVED' },
    { id: 'pay_sky_no_match', agencyHint: 'UNKNOWN-REF-77', externalRef: 'UTR26119001', amountMinor: 1000000, currency: 'INR', receivedOffset: 'H-5', expectedStatus: 'RECEIVED' },
    { id: 'pay_wrong_amount', agencyHint: 'HFVA-SKY-001', externalRef: 'UTR26119002', amountMinor: 1234500, currency: 'INR', expectedAmountMinor: 1000000, receivedOffset: 'H-4', expectedStatus: 'RECEIVED' },
    { id: 'pay_missing_rate', agencyHint: 'HFVA-SKY-001', externalRef: 'UTR26119003', amountMinor: 5000, currency: 'USD', receivedOffset: 'H-6', expectedStatus: 'RECEIVED' },
  ],
  historicalCredited: [
    { id: 'pay_sky_opening', agencyId: 'agency_skyline', agencyHint: 'HFVA-SKY-001', externalRef: 'UTR26110501', receivedOffset: 'D-30' },
    { id: 'pay_orb_opening', agencyId: 'agency_orbit', agencyHint: 'HFVA-ORB-001', externalRef: 'UTR26110502', receivedOffset: 'D-30' },
    { id: 'pay_ast_opening', agencyId: 'agency_aster', agencyHint: 'HFVA-AST-001', externalRef: 'UTR26110503', receivedOffset: 'D-30' },
  ],
  replayCommands: [{ id: 'pay_duplicate_replay', replaysExternalRef: 'UTR26111001', note: 'Test input only — replays the same event, never a second row.' }],
});

// ---------- PNR imports ----------
write('import-pnrs.json', {
  records: [
    { key: 'imp_sky_ok', provider: 'SABRE', pcc: 'S9KY', pnr: 'SBD101', ownerAgencyId: 'agency_skyline', airlinePnr: 'AI8K1Q', itinerary: { origin: 'BOM', destination: 'DEL', airlineCode: 'AI', flightNumber: 'AI 801', departureOffset: 'D+9', durationMin: 130, cabin: 'ECONOMY' }, passengers: ['Kavya Rao'], ticketStatus: 'TICKETED', ticketNumbers: ['098-2400801001'], fareRuleProfileId: 'A_FLEXIBLE', agencySellMinor: 850000, supplierCostMinor: 795000, bookedOffset: 'D-2' },
    { key: 'imp_orb_ok', provider: 'SABRE', pcc: 'O4RB', pnr: 'SBD202', ownerAgencyId: 'agency_orbit', airlinePnr: 'AI2X9P', itinerary: { origin: 'DEL', destination: 'BOM', airlineCode: 'AI', flightNumber: 'AI 802', departureOffset: 'D+11', durationMin: 130, cabin: 'ECONOMY' }, passengers: ['Nikhil Arora'], ticketStatus: 'TICKETED', ticketNumbers: ['098-2400802001'], fareRuleProfileId: 'B_RESTRICTED', agencySellMinor: 1100000, supplierCostMinor: 1020000, bookedOffset: 'D-3' },
    { key: 'imp_hub_ops', provider: 'SABRE', pcc: 'H7FA', pnr: 'SBD303', ownerAgencyId: null, airlinePnr: '6E7Z3M', itinerary: { origin: 'BOM', destination: 'GOI', airlineCode: '6E', flightNumber: '6E 803', departureOffset: 'D+6', durationMin: 75, cabin: 'ECONOMY' }, passengers: ['Leela Fernandes'], ticketStatus: 'TICKETED', ticketNumbers: ['098-2400803001'], fareRuleProfileId: 'A_FLEXIBLE', agencySellMinor: 640000, supplierCostMinor: 590000, bookedOffset: 'D-1' },
    { key: 'imp_duplicate', provider: 'SABRE', pcc: 'S9KY', pnr: 'SBD404', ownerAgencyId: 'agency_skyline', airlinePnr: 'AI4D0W', itinerary: { origin: 'BOM', destination: 'DEL', airlineCode: 'AI', flightNumber: 'AI 710', departureOffset: 'D-4', durationMin: 130, cabin: 'ECONOMY' }, passengers: ['Ira Banerjee'], ticketStatus: 'TICKETED', ticketNumbers: ['098-2410000010'], fareRuleProfileId: 'A_FLEXIBLE', agencySellMinor: 1700000, supplierCostMinor: 1400000, bookedOffset: 'D-15', alreadyImportedAsBooking: 'HFB1010' },
    { key: 'imp_no_ticket', provider: 'SABRE', pcc: 'H7FA', pnr: 'SBD505', ownerAgencyId: 'agency_aster', airlinePnr: '6E5T2K', itinerary: { origin: 'BLR', destination: 'DEL', airlineCode: '6E', flightNumber: '6E 805', departureOffset: 'D+7', durationMin: 165, cabin: 'ECONOMY' }, passengers: ['Omkar Patil'], ticketStatus: 'NOT_ISSUED', ticketNumbers: [], fareRuleProfileId: 'B_RESTRICTED', agencySellMinor: 720000, supplierCostMinor: 670000, bookedOffset: 'D-1' },
    { key: 'imp_sky_family', provider: 'SABRE', pcc: 'S9KY', pnr: 'SBD111', ownerAgencyId: 'agency_skyline', airlinePnr: '6E3H8R', itinerary: { origin: 'BOM', destination: 'GOI', airlineCode: '6E', flightNumber: '6E 811', departureOffset: 'D+12', durationMin: 75, cabin: 'ECONOMY' }, passengers: ['Mr Sameer Joshi', 'Ms Anjali Joshi'], ticketStatus: 'TICKETED', ticketNumbers: ['098-2400811001', '098-2400811002'], fareRuleProfileId: 'A_FLEXIBLE', agencySellMinor: 1100000, supplierCostMinor: 1020000, bookedOffset: 'D-4' },
    { key: 'imp_sky_corp', provider: 'SABRE', pcc: 'S9KY', pnr: 'SBD112', ownerAgencyId: 'agency_skyline', airlinePnr: 'AI6P2L', itinerary: { origin: 'DEL', destination: 'BLR', airlineCode: 'AI', flightNumber: 'AI 812', departureOffset: 'D+5', durationMin: 170, cabin: 'ECONOMY' }, passengers: ['Mr Deepak Malhotra'], ticketStatus: 'TICKETED', ticketNumbers: ['098-2400812001'], fareRuleProfileId: 'B_RESTRICTED', agencySellMinor: 690000, supplierCostMinor: 640000, bookedOffset: 'D-3' },
    { key: 'imp_sky_trio', provider: 'SABRE', pcc: 'S9KY', pnr: 'SBD113', ownerAgencyId: 'agency_skyline', airlinePnr: 'AI9C4T', itinerary: { origin: 'BOM', destination: 'DEL', airlineCode: 'AI', flightNumber: 'AI 813', departureOffset: 'D+15', durationMin: 130, cabin: 'ECONOMY' }, passengers: ['Mr Harish Menon', 'Ms Lata Menon', 'Mr Arvind Menon'], ticketStatus: 'TICKETED', ticketNumbers: ['098-2400813001', '098-2400813002', '098-2400813003'], fareRuleProfileId: 'A_FLEXIBLE', agencySellMinor: 2070000, supplierCostMinor: 1920000, bookedOffset: 'D-2' },
    { key: 'imp_orb_team', provider: 'SABRE', pcc: 'O4RB', pnr: 'SBD212', ownerAgencyId: 'agency_orbit', airlinePnr: '6E1M7Q', itinerary: { origin: 'BLR', destination: 'DEL', airlineCode: '6E', flightNumber: '6E 812', departureOffset: 'D+8', durationMin: 165, cabin: 'ECONOMY' }, passengers: ['Mr Prakash Iyer', 'Ms Revathi Iyer'], ticketStatus: 'TICKETED', ticketNumbers: ['098-2400822001', '098-2400822002'], fareRuleProfileId: 'A_FLEXIBLE', agencySellMinor: 1360000, supplierCostMinor: 1260000, bookedOffset: 'D-2' },
    { key: 'imp_ast_ok', provider: 'SABRE', pcc: 'H7FA', pnr: 'SBD313', ownerAgencyId: 'agency_aster', airlinePnr: 'AI3W8N', itinerary: { origin: 'DEL', destination: 'BOM', airlineCode: 'AI', flightNumber: 'AI 833', departureOffset: 'D+9', durationMin: 130, cabin: 'ECONOMY' }, passengers: ['Ms Gauri Sethi'], ticketStatus: 'TICKETED', ticketNumbers: ['098-2400833001'], fareRuleProfileId: 'A_FLEXIBLE', agencySellMinor: 720000, supplierCostMinor: 670000, bookedOffset: 'D-1' },
  ],
  negativeTests: [
    { key: 'imp_bad_pcc', provider: 'SABRE', pcc: 'O4RB', pnr: 'SBD101', actorAgency: 'agency_orbit', expected: 'PNR_NOT_FOUND' },
    { key: 'imp_other_tenant', provider: 'SABRE', pcc: 'S9KY', pnr: 'SBD101', actorAgency: 'agency_orbit', expected: 'PNR_NOT_FOUND' },
    { key: 'imp_unknown', provider: 'SABRE', pcc: 'H7FA', pnr: 'NOPE99', actorAgency: null, expected: 'PNR_NOT_FOUND' },
  ],
});

// ---------- support / guided samples ----------
write('support-cases.json', [
  { id: 'CASE-S001', agencyId: 'agency_skyline', bookingId: 'HFB1009', source: 'SYSTEM', category: 'TICKETING_EXCEPTION', summary: 'Booking failure on HFB1009 — no funds charged', status: 'RESOLVED', priority: 'MEDIUM', assignedTo: 'user_hub_ops', createdOffset: 'D-1', events: [['OPEN', 'D-1'], ['ASSIGNED', 'H-20'], ['RESOLVED', 'H-12']] },
  { id: 'CASE-S002', agencyId: 'agency_skyline', bookingId: 'HFB1003', source: 'SYSTEM', category: 'SUPPLIER_REFUND_PENDING', summary: 'RFD1003 awaiting supplier settlement (INR 6,903 expected)', status: 'AWAITING_EXTERNAL', priority: 'MEDIUM', assignedTo: 'user_hub_ops', createdOffset: 'H-22', events: [['OPEN', 'H-22'], ['ASSIGNED', 'H-20'], ['AWAITING_EXTERNAL', 'H-18']] },
  { id: 'CASE-S003', agencyId: 'agency_aster', bookingId: null, source: 'SYSTEM', category: 'CREDIT_OVERDUE', summary: 'Aster Holidays daily credit overdue — new credit draws blocked by policy v2', status: 'IN_PROGRESS', priority: 'HIGH', assignedTo: 'user_hub_finance', createdOffset: 'H-23', events: [['OPEN', 'H-23'], ['ASSIGNED', 'H-21'], ['IN_PROGRESS', 'H-10']] },
  { id: 'CASE-S004', agencyId: 'agency_skyline', bookingId: null, source: 'SYSTEM', category: 'UNMATCHED_PAYMENT', summary: 'UTR26119001 received without a recognised agency reference', status: 'OPEN', priority: 'HIGH', assignedTo: null, createdOffset: 'H-5', events: [['OPEN', 'H-5']] },
  { id: 'CASE-S005', agencyId: 'agency_aster', bookingId: 'HFB1022', source: 'CHATBOT', category: 'COMPLAINT', summary: 'Refund timeline query for SBX022', status: 'CLOSED', priority: 'LOW', assignedTo: 'user_hub_ops', createdOffset: 'D-3', events: [['OPEN', 'D-3'], ['ASSIGNED', 'D-3'], ['RESOLVED', 'D-2'], ['CLOSED', 'D-2']] },
]);
write('guided-samples.json', {
  heldCarts: [
    { id: 'cart_demo_001', agencyId: 'agency_skyline', route: 'BOM → SIN', flight: 'SQ 109', travelers: 2, holdAmountMinor: 3360000, holdExpiresInMinutes: 95, status: 'HELD', label: '' },
    { id: 'cart_demo_002', agencyId: 'agency_skyline', route: 'DEL → DXB', flight: 'EK 111', travelers: 1, holdAmountMinor: 1380000, holdExpiresInMinutes: 12, status: 'EXPIRING', label: '' },
  ],
  amendmentOptions: [
    { type: 'DATE_CHANGE', label: 'Change departure date', options: [{ id: 'opt_plus1', label: 'Same flight, next day', fareDifferenceMinor: 45000 }, { id: 'opt_plus3', label: 'Same flight, +3 days', fareDifferenceMinor: 0 }] },
    { type: 'NAME_CORRECTION', label: 'Permitted name correction (spelling)', options: [{ id: 'opt_name', label: 'Correct up to 3 characters', fareDifferenceMinor: 0 }] },
    { type: 'REBOOKING', label: 'Rebook on alternative flight', options: [{ id: 'opt_rebook', label: 'Earlier flight same day', fareDifferenceMinor: 120000 }] },
    { type: 'ANCILLARY', label: 'Ancillary request (baggage / meal / seat)', options: [{ id: 'opt_bag', label: 'Extra 10 kg baggage', fareDifferenceMinor: 250000 }, { id: 'opt_meal', label: 'Pre-book meal', fareDifferenceMinor: 45000 }] },
  ],
  gdsQueues: [
    { provider: 'SABRE', pcc: 'H7FA', queue: 'Q50 Schedule change', count: 2, status: 'Notification' },
    { provider: 'SABRE', pcc: 'S9KY', queue: 'Q7 Ticketing time limit', count: 1, status: 'Notification' },
    { provider: 'TRAVELPORT', pcc: 'T1PA', queue: '—', count: 0, status: 'Planned integration' },
    { provider: 'AMADEUS', pcc: 'A1MA', queue: '—', count: 0, status: 'Planned integration' },
  ],
  flightStatus: { SCHEDULED: 'On schedule', DELAYED: 'Delayed 45 min', CANCELLED: 'Cancelled by airline' },
  seedAmendment: { id: 'AMD1001', agencyId: 'agency_skyline', bookingId: 'HFB1002', type: 'DATE_CHANGE', status: 'QUOTED', createdOffset: 'D-1' },
});

// ---------- chatbot ----------
const L = (en: string, hi: string, hinglish: string) => ({ en, hi, hinglish });
write('chatbot-scenarios.json', {
  mode: 'SCRIPTED_FINITE_STATE', languages: [{ id: 'en', label: 'English' }, { id: 'hi', label: 'हिन्दी' }, { id: 'hinglish', label: 'Hinglish' }],
  messages: {
    welcome: L('Hi! I am the Hubfares Help assistant (scripted demo). Choose a language to continue.', 'नमस्ते! मैं Hubfares सहायता सहायक हूँ (स्क्रिप्टेड डेमो)। आगे बढ़ने के लिए भाषा चुनें।', 'Hi! Main Hubfares Help assistant hoon (scripted demo). Aage badhne ke liye language choose karein.'),
    mainMenu: L('How can we help you today?', 'आज हम आपकी कैसे मदद करें?', 'Aaj hum aapki kaise help karein?'),
    askPnr: L('Please enter the PNR of your booking.', 'कृपया अपनी बुकिंग का PNR दर्ज करें।', 'Please apni booking ka PNR enter karein.'),
    askCase: L('Please enter your case or refund reference.', 'कृपया अपना केस या रिफंड संदर्भ दर्ज करें।', 'Please apna case ya refund reference enter karein.'),
    notFound: L('No matching booking found for your agency. Verify the reference or contact Hubfares Support.', 'आपकी एजेंसी के लिए कोई मेल खाती बुकिंग नहीं मिली। संदर्भ जांचें या Hubfares सपोर्ट से संपर्क करें।', 'Aapki agency ke liye koi matching booking nahi mili. Reference check karein ya Hubfares Support se contact karein.'),
    confirmNotice: L('This creates a demo support request for Hubfares Operations. It does not cancel, change or refund anything by itself.', 'यह Hubfares ऑपरेशंस के लिए एक डेमो सपोर्ट अनुरोध बनाता है। यह स्वयं कुछ भी रद्द, बदल या रिफंड नहीं करता।', 'Yeh Hubfares Operations ke liye ek demo support request banata hai. Yeh khud kuch cancel, change ya refund nahi karta.'),
    caseCreated: L('Your request has been logged. Reference:', 'आपका अनुरोध दर्ज हो गया है। संदर्भ:', 'Aapki request log ho gayi hai. Reference:'),
    fallback: L('I can only help with the options below.', 'मैं केवल नीचे दिए विकल्पों में मदद कर सकता हूँ।', 'Main sirf neeche diye options mein help kar sakta hoon.'),
    callCenter: L('Hubfares Call Center (demo): +91 20 0000 0000, 24×7. Live transfer is a planned integration.', 'Hubfares कॉल सेंटर (डेमो): +91 20 0000 0000, 24×7। लाइव ट्रांसफर नियोजित इंटीग्रेशन है।', 'Hubfares Call Center (demo): +91 20 0000 0000, 24×7. Live transfer planned integration hai.'),
    details: L('Add a short description (optional).', 'संक्षिप्त विवरण जोड़ें (वैकल्पिक)।', 'Short description add karein (optional).'),
  },
  menu: [
    { id: 'CLAIM_REFUND', label: L('Claim a Refund', 'रिफंड का दावा', 'Refund Claim karein'), category: 'REFUND_REQUEST', needsPnr: true, options: [
      { id: 'CANCEL_BOOKING_REFUND', label: L('Cancel-booking refund', 'बुकिंग रद्द करने पर रिफंड', 'Booking cancel refund') },
      { id: 'AIRLINE_CANCELLED', label: L('Airline-initiated cancellation', 'एयरलाइन द्वारा रद्दीकरण', 'Airline ne cancel kiya') },
      { id: 'PARTIAL_REFUND', label: L('Partial refund', 'आंशिक रिफंड', 'Partial refund') },
      { id: 'ESTIMATE_REFUND', label: L('Estimate refund', 'रिफंड अनुमान', 'Refund estimate dekhein'), informational: true },
      { id: 'SUBMIT_CLAIM', label: L('Submit claim', 'दावा जमा करें', 'Claim submit karein') } ] },
    { id: 'REFUND_STATUS', label: L('Refund Status', 'रिफंड स्थिति', 'Refund Status'), category: 'REFUND_ESCALATION', options: [
      { id: 'BY_PNR', label: L('By PNR', 'PNR से', 'PNR se'), needsPnr: true, informational: true },
      { id: 'BY_CASE', label: L('By case / refund ID', 'केस / रिफंड आईडी से', 'Case / refund ID se'), needsCase: true, informational: true },
      { id: 'PENDING_SUPPLIER', label: L('Pending with Supplier', 'सप्लायर के पास लंबित', 'Supplier ke paas pending'), needsPnr: true, informational: true },
      { id: 'ESCALATE_DELAYED', label: L('Escalate delayed refund', 'विलंबित रिफंड एस्केलेट करें', 'Delayed refund escalate karein'), needsPnr: true } ] },
    { id: 'FLIGHT_STATUS', label: L('Flight Status', 'उड़ान स्थिति', 'Flight Status'), options: [
      { id: 'STATUS_BY_PNR', label: L('By PNR', 'PNR से', 'PNR se'), needsPnr: true, informational: true },
      { id: 'STATUS_BY_FLIGHT', label: L('Airline + flight number/date', 'एयरलाइन + उड़ान संख्या/तारीख', 'Airline + flight number/date'), needsFlight: true, informational: true } ] },
    { id: 'CHANGE_FLIGHT', label: L('Change Flight', 'उड़ान बदलें', 'Flight Change'), category: 'AMENDMENT_REQUEST', needsPnr: true, options: [
      { id: 'CHANGE_DATE', label: L('Change departure date', 'प्रस्थान तिथि बदलें', 'Departure date change') },
      { id: 'CHANGE_ITINERARY', label: L('Change itinerary', 'यात्रा कार्यक्रम बदलें', 'Itinerary change') },
      { id: 'ESTIMATED_CHARGES', label: L('Estimated charges', 'अनुमानित शुल्क', 'Estimated charges'), informational: true },
      { id: 'SUBMIT_AMENDMENT', label: L('Submit amendment', 'संशोधन जमा करें', 'Amendment submit karein') } ] },
    { id: 'MODIFY_BOOKING', label: L('Modify Booking', 'बुकिंग संशोधित करें', 'Booking Modify'), category: 'MODIFICATION_REQUEST', needsPnr: true, options: [
      { id: 'CHANGE_CONTACT', label: L('Change contact', 'संपर्क बदलें', 'Contact change') },
      { id: 'PAX_CORRECTION', label: L('Passenger-detail correction', 'यात्री विवरण सुधार', 'Passenger detail correction') },
      { id: 'ADD_BAGGAGE', label: L('Add baggage', 'बैगेज जोड़ें', 'Baggage add') },
      { id: 'ADD_MEAL', label: L('Add meal', 'भोजन जोड़ें', 'Meal add') },
      { id: 'SEAT_REQUEST', label: L('Seat request', 'सीट अनुरोध', 'Seat request') },
      { id: 'MODIFY_OTHER', label: L('Other', 'अन्य', 'Other') } ] },
    { id: 'COMPLAINTS', label: L('Complaints / Support', 'शिकायत / सहायता', 'Complaint / Support'), category: 'COMPLAINT', pnrOptional: true, options: [
      { id: 'BOOKING_ISSUE', label: L('Booking issue', 'बुकिंग समस्या', 'Booking issue') },
      { id: 'PAYMENT_ISSUE', label: L('Payment issue', 'भुगतान समस्या', 'Payment issue') },
      { id: 'TICKETING_ISSUE', label: L('Ticketing issue', 'टिकटिंग समस्या', 'Ticketing issue') },
      { id: 'REFUND_COMPLAINT', label: L('Refund complaint', 'रिफंड शिकायत', 'Refund complaint') },
      { id: 'AMENDMENT_COMPLAINT', label: L('Amendment', 'संशोधन', 'Amendment') },
      { id: 'COMPLAINT_OTHER', label: L('Other', 'अन्य', 'Other') } ] },
    { id: 'MORE', label: L('More Options', 'अधिक विकल्प', 'More Options'), options: [
      { id: 'E_TICKET', label: L('E-ticket', 'ई-टिकट', 'E-ticket'), needsPnr: true, informational: true },
      { id: 'FARE_RULES', label: L('Fare Rules', 'किराया नियम', 'Fare Rules'), needsPnr: true, informational: true },
      { id: 'INVOICE', label: L('Invoice / receipt', 'चालान / रसीद', 'Invoice / receipt'), needsPnr: true, informational: true },
      { id: 'WALLET_HELP', label: L('Wallet help', 'वॉलेट सहायता', 'Wallet help'), informational: true },
      { id: 'MY_CASES', label: L('Existing support cases', 'मौजूदा सहायता केस', 'Existing support cases'), informational: true },
      { id: 'CONTACT_SUPPORT', label: L('Contact Support', 'सहायता से संपर्क करें', 'Support se contact'), informational: true } ] },
  ],
  controls: { back: L('Back', 'वापस', 'Back'), mainMenu: L('Main Menu', 'मुख्य मेनू', 'Main Menu'), restart: L('Restart', 'फिर से शुरू', 'Restart'), language: L('Change Language', 'भाषा बदलें', 'Language change'), callCenter: L('Talk to Call Center', 'कॉल सेंटर से बात करें', 'Call Center se baat'), close: L('Close', 'बंद करें', 'Close'), submit: L('Submit request', 'अनुरोध जमा करें', 'Request submit karein') },
  scenarios: [
    { key: 'chat_sky_refund', user: 'user_sky_agent', pnr: 'SBX001', expected: 'REFUND_REQUEST case' },
    { key: 'chat_orb_status', user: 'user_orb_admin', reference: 'RFD1012', expected: 'CREDITED, supplier PENDING' },
    { key: 'chat_sky_change', user: 'user_sky_agent', pnr: 'SBX002', expected: 'AMENDMENT_REQUEST case' },
    { key: 'chat_sky_complaint', user: 'user_sky_admin', pnr: null, expected: 'COMPLAINT case' },
    { key: 'chat_wrong_tenant', user: 'user_orb_agent', pnr: 'SBX001', expected: 'neutral not found' },
    { key: 'chat_unknown_pnr', user: 'user_sky_agent', pnr: 'NOTREAL1', expected: 'neutral not found' },
    { key: 'chat_cancel_not_authorized', user: 'user_sky_agent', pnr: 'SBX001', expected: 'case only; booking unchanged' },
  ],
  simulatedFlightStatus: { rule: 'deterministic by flight number last digit: 0-6 SCHEDULED, 7-8 DELAYED, 9 CANCELLED', label: 'Simulated status' },
});

// ---------- documents ----------
async function pdf(file: string, title: string, lines: string[]) {
  const doc = await PDFDocument.create();
  doc.setTitle(title); doc.setAuthor('Hubfares POC synthetic fixture'); doc.setCreationDate(new Date('2026-11-19T00:00:00Z')); doc.setModificationDate(new Date('2026-11-19T00:00:00Z')); doc.setProducer('hubfares-fixtures'); doc.setCreator('hubfares-fixtures');
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 0, y: 792, width: 595, height: 50, color: rgb(0.15, 0.15, 0.17) });
  page.drawText('SPECIMEN - FOR DEMONSTRATION ONLY', { x: 40, y: 812, size: 11, font: bold, color: rgb(1, 0.55, 0.25) });
  page.drawText(title, { x: 40, y: 750, size: 16, font: bold, color: rgb(0.1, 0.1, 0.1) });
  let y = 715;
  for (const line of lines) { page.drawText(line, { x: 40, y, size: 11, font, color: rgb(0.15, 0.2, 0.3) }); y -= 22; }
  page.drawText('Specimen document. Contains no real identity, PAN or Aadhaar data.', { x: 40, y: 60, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
  fs.writeFileSync(path.join(FX, 'documents', file), await doc.save({ useObjectStreams: false }));
}
function png(file: string, w: number, h: number) {
  // deterministic low-contrast noise image (intentionally unreadable) — LCG, no Math.random
  let s = 42; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = 150 + Math.floor(rnd() * 40); }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(path.join(FX, 'documents', file), Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
async function docs() {
  fs.mkdirSync(path.join(FX, 'documents'), { recursive: true });
  await pdf('sample-company-registration.pdf', 'Certificate of Business Registration', [
    'Document Type: BUSINESS_REGISTRATION',
    'Organization Name: Bluebird Travels',
    'Entity Type: Private Limited',
    'Registration Number: U63090MH2021PTC000777',
    'GSTIN: 27AAKCB0777B1Z1',
    'Registered Address: 14 Riverside Plaza, Koregaon Park',
    'City: Pune',
    'State: Maharashtra',
    'Postal Code: 411001',
    'Country: India',
    'Contact Email: hello@bluebird.example.com',
    'Contact Mobile: +919000000777',
    'Website: www bluebird-travels example com',
  ]);
  await pdf('sample-pan-card.pdf', 'Permanent Account Number - Specimen', [
    'Document Type: PAN',
    'PAN: AAKCB0777B',
    'Name: Bluebird Travels',
    'Proprietor / Director: Riya Kulkarni',
    'Date of Incorporation: 2021-04-01',
      ]);
  await pdf('sample-identity-masked.pdf', 'Identity Document - Masked Specimen', [
    'Document Type: IDENTITY_MASKED',
    'Name: Riya Kulkarni',
    'Masked ID: XXXX XXXX 0777',
    'Year of Birth: 1988',
    'Address City: Pune',
    'Note: no complete identity number is present in this specimen',
  ]);
  png('sample-unreadable-scan.png', 320, 200);
  write('documents/extraction-expected.json', {
    'sample-company-registration.pdf': { documentType: 'BUSINESS_REGISTRATION', engine: 'PDF_TEXT', fields: {
      agencyName: { value: 'Bluebird Travels', minConfidence: 0.9 }, entityType: { value: 'PRIVATE_LIMITED', minConfidence: 0.9 },
      registrationNumber: { value: 'U63090MH2021PTC000777', minConfidence: 0.9 }, gstin: { value: '27AAKCB0777B1Z1', minConfidence: 0.9 },
      addressLine1: { value: '14 Riverside Plaza, Koregaon Park', minConfidence: 0.85 }, city: { value: 'Pune', minConfidence: 0.9 },
      state: { value: 'Maharashtra', minConfidence: 0.9 }, postalCode: { value: '411001', minConfidence: 0.9 }, country: { value: 'India', minConfidence: 0.9 },
      contactEmail: { value: 'hello@bluebird.example.com', minConfidence: 0.9 }, contactMobile: { value: '+919000000777', minConfidence: 0.9 },
      website: { value: 'https://www.bluebird-travels.example.com', maxConfidence: 0.75, reviewRequired: true } } },
    'sample-pan-card.pdf': { documentType: 'PAN', engine: 'PDF_TEXT', fields: { pan: { value: 'AAKCB0777B', minConfidence: 0.9 }, agencyName: { value: 'Bluebird Travels', minConfidence: 0.85 }, directorName: { value: 'Riya Kulkarni', minConfidence: 0.85 } } },
    'sample-identity-masked.pdf': { documentType: 'IDENTITY_MASKED', engine: 'PDF_TEXT', fields: { directorName: { value: 'Riya Kulkarni', minConfidence: 0.85 }, maskedId: { value: 'XXXX XXXX 0777', minConfidence: 0.85 } } },
    'sample-unreadable-scan.png': { documentType: 'UNKNOWN', engine: 'UNSUPPORTED', error: 'DOCUMENT_UNREADABLE', fields: {} },
  });
}
docs().then(() => console.log('fixtures generated'));
