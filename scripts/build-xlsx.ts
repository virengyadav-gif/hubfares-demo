/** npm run reports:build — deterministic frozen rows (seeded PRNG) + six real all-agency XLSX workbooks. */
import fs from 'node:fs';
import path from 'node:path';
import { REPORTS, AGENCY_NAMES, REPORT_SNAPSHOT_AT, ReportRow } from '../src/features/reports/catalog';
import { buildWorkbook } from '../src/features/reports/workbook';

let seed = 20261119;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const money = (lo: number, hi: number) => Math.round((lo + rnd() * (hi - lo)) / 10) * 10;
const ROUTES = ['BOM-DEL', 'DEL-BOM', 'BOM-LHR', 'BOM-SIN', 'DEL-DXB', 'BLR-DEL', 'BOM-GOI', 'BOM-FRA', 'DEL-BLR'];
const AIRLINES = ['AI', '6E', 'BA', 'QR', 'EK', 'SQ', 'LH'];
const agencyFor = (i: number) => (i < 40 ? 'agency_skyline' : i < 75 ? 'agency_orbit' : 'agency_aster');
const dateFor = (i: number) => new Date(Date.parse('2026-08-20T05:00:00Z') + Math.floor(i * 0.9 + rnd() * 3) * 86400000 + Math.floor(rnd() * 12) * 3600000).toISOString().slice(0, 16).replace('T', ' ');

function rowsFor(prefix: string, type: string): ReportRow[] {
  const out: ReportRow[] = [];
  for (let i = 0; i < 100; i++) {
    const agencyId = agencyFor(i);
    const base: ReportRow = { SampleRecordId: `RPT-${prefix}-${String(i + 1).padStart(3, '0')}`, TransactionDate: dateFor(i), AgencyId: agencyId, AgencyName: AGENCY_NAMES[agencyId], BookingReference: `HFS-${prefix}-${String(5000 + i * 7)}`, ReportScope: 'ALL_AGENCIES_SAMPLE', Currency: 'INR', SampleData: 'YES' };
    const sup = money(3000, 60000), sell = sup + money(150, 2500);
    switch (type) {
      case 'airline-transactions': Object.assign(base, { Status: pick(['TICKETED', 'TICKETED', 'TICKETED', 'CANCELLED', 'VOIDED']), Airline: pick(AIRLINES), GDS: 'SABRE (sample)', Supplier: pick(['Sabre mock', 'Consolidator A', 'Consolidator B']), Route: pick(ROUTES), FareBrand: pick(['Saver', 'Standard', 'Flex']), SupplierChargeINR: sup, AgencyChargeINR: sell }); base.TicketStatus = base.Status; break;
      case 'booking-transactions': { const tax = Math.round(sup * 0.15); Object.assign(base, { Status: pick(['TICKETED', 'TICKETED', 'PNR_CREATED', 'CANCELLED']), PassengerReference: `PAX-${String(10000 + i * 13)}`, PNR: `SMP${String(100 + i)}`, TicketNumber: `SAMPLE-TKT-${String(700000 + i * 11)}`, TripType: pick(['ONE_WAY', 'ONE_WAY', 'ROUND_TRIP']), Cabin: pick(['ECONOMY', 'ECONOMY', 'ECONOMY', 'BUSINESS']), BaseFareINR: sup - tax, TaxesINR: tax, AgencyTotalINR: sell }); break; }
      case 'refund-transactions': { const exp = money(1000, 30000); const paid = pick([0, exp]); const sexp = Math.max(0, exp - money(200, 1500)); Object.assign(base, { Status: paid ? 'CREDITED' : 'PENDING', ClaimReference: `SMP-REF-${String(300 + i)}`, CancellationDate: dateFor(i), ExpectedRefundINR: exp, OtaPaidINR: paid, SupplierExpectedINR: sexp, SupplierReceivedINR: pick([0, sexp]), PayoutStatus: paid ? 'CREDITED' : 'PENDING', SupplierStatus: pick(['PENDING', 'RECEIVED']) }); break; }
      case 'exchange-transactions': { const r = pick(ROUTES); Object.assign(base, { Status: pick(['REISSUED', 'QUOTED', 'REQUESTED', 'CLOSED']), OriginalBooking: base.BookingReference, ReissueReference: `SMP-RIS-${String(800 + i)}`, OldItinerary: r, NewItinerary: r, AirlineChangeFeeINR: pick([1500, 2000, 2500, 3500]), FareDifferenceINR: money(0, 6000) }); base.RequestStatus = base.Status; break; }
      case 'ancillary-services': { const q = 1 + Math.floor(rnd() * 3); const c = money(300, 3000); Object.assign(base, { Status: pick(['FULFILLED', 'REQUESTED', 'FULFILLED']), AncillaryType: pick(['Extra baggage', 'Seat', 'Meal', 'Lounge', 'Priority boarding']), Supplier: pick(['Sabre mock', 'Consolidator A']), Quantity: q, CostINR: c * q, AgencySellingPriceINR: (c + money(50, 400)) * q }); base.FulfillmentStatus = base.Status; break; }
      default: Object.assign(base, { Status: pick(['APPROVED', 'PENDING', 'APPROVED']), CaseReference: `SMP-CASE-${String(600 + i)}`, AdjustmentType: pick(['Service fee adjustment', 'Goodwill credit', 'Visa assistance', 'Insurance (sample)', 'Rounding correction']), AmountINR: money(100, 5000), ApprovalStatus: pick(['APPROVED', 'PENDING']), ReconciliationStatus: pick(['RECONCILED', 'OPEN']) });
    }
    out.push(base);
  }
  return out;
}
(async () => {
  const dir = path.resolve('fixtures/reports');
  fs.mkdirSync(dir, { recursive: true });
  const all: Record<string, ReportRow[]> = {};
  for (const r of REPORTS) {
    all[r.type] = rowsFor(r.prefix, r.type);
    fs.writeFileSync(path.join(dir, `${r.type}.xlsx`), await buildWorkbook(r.type, all[r.type], 'ALL AGENCIES (authorised Hubfares roles)'));
  }
  fs.writeFileSync(path.join(dir, 'report-rows.json'), JSON.stringify({ fixtureVersion: 'hubfares-v1.1-seed-002', snapshotAt: REPORT_SNAPSHOT_AT, mutable: false, reports: all }, null, 1) + '\n');
  console.log(`Built ${REPORTS.length} XLSX reports (100 rows each) in fixtures/reports`);
})();
