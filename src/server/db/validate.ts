/** Fixture + seeded-state validation (Technical Design §12.3, Data & Mocks §16). Returns named checks; any FAIL fails closed. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { sql } from 'drizzle-orm';
import { openDb } from './client';
import { seedDatabase, loadFixture } from './seed';
import type { DB } from './client';
import * as s from './schema';
import { fundingPosition } from '@/features/wallet-credit/position';
import { kpisFor } from '@/features/executive/kpis';

export type Check = { name: string; ok: boolean; detail?: string };

export function validateStructure(): Check[] {
  const out: Check[] = [];
  const add = (name: string, ok: boolean, detail?: string) => out.push({ name, ok, detail });
  const profiles = loadFixture<any[]>('fare-rules.json');
  add('Exactly two fare-rule profiles A_FLEXIBLE/B_RESTRICTED', profiles.length === 2 && profiles.map((p) => p.id).sort().join() === 'A_FLEXIBLE,B_RESTRICTED');
  const A = profiles.find((p) => p.id === 'A_FLEXIBLE'), B = profiles.find((p) => p.id === 'B_RESTRICTED');
  const cs = (p: any, id: string) => p.cancellationSlabs.find((x: any) => x.id === id);
  add('Fare values match Product Spec §5.3', cs(A, 'S1').supplierPenaltyMinor === 199900 && cs(A, 'S2').supplierPenaltyMinor === 104700 && cs(B, 'S1').supplierPenaltyMinor === 500000 && cs(B, 'S2').supplierPenaltyMinor === 300000 && [A, B].every((p) => cs(p, 'S0').nonRefundable && cs(p, 'S1').serviceFeeMinor === 5000 && cs(p, 'S2').serviceFeeMinor === 5000));
  add('Slab boundaries [0,2h) [2h,24h) [24h,∞)', [A, B].every((p) => cs(p, 'S0').maxLeadMsExclusive === 7200000 && cs(p, 'S1').minLeadMs === 7200000 && cs(p, 'S1').maxLeadMsExclusive === 86400000 && cs(p, 'S2').minLeadMs === 86400000));
  const flights = loadFixture('flights.json').offers as any[];
  const brands = flights.flatMap((o) => o.brands);
  add('20 flight offers', flights.length === 20, `${flights.length}`);
  add('Every brand references one of two profiles', brands.every((b) => b.ruleProfileId === 'A_FLEXIBLE' || b.ruleProfileId === 'B_RESTRICTED'));
  add('≥12 offers with ≥2 brands, ≥4 with ≥3', flights.filter((o) => o.brands.length >= 2).length >= 12 && flights.filter((o) => o.brands.length >= 3).length >= 4);
  add('≥8 domestic and ≥8 international offers', flights.filter((o) => !o.international).length >= 8 && flights.filter((o) => o.international).length >= 8);
  add('Brand money is integer paise', brands.every((b) => Number.isInteger(b.supplierBaseMinor) && Number.isInteger(b.supplierTaxMinor)));
  const ids = new Set<string>(); let dup = false;
  for (const x of [...flights.map((o) => o.id), ...brands.map((b) => b.id)]) { if (ids.has(x)) dup = true; ids.add(x); }
  add('No duplicate offer/brand IDs', !dup);
  const users = loadFixture('users.json').users as any[];
  add('Agency roles carry agencyId; hub roles do not', users.every((u) => (u.role.startsWith('AGENCY_') ? !!u.agencyId : !u.agencyId)));
  add('No OTA user holds Hubfares role', users.filter((u) => u.agencyId).every((u) => u.role.startsWith('AGENCY_')));
  add('Synthetic emails only (example.com)', users.every((u) => u.email.endsWith('.example.com')));
  const bks = loadFixture('bookings.json').bookings as any[];
  add('24 historical bookings', bks.length === 24);
  add('Tickets only on ticketed-state bookings', bks.every((b) => (b.ticketNumber ? ['TICKETED', 'CANCELLED', 'VOIDED', 'IMPORTED_TICKETED'].includes(b.status) : !['TICKETED', 'CANCELLED', 'VOIDED', 'IMPORTED_TICKETED'].includes(b.status))));
  add('FAILED bookings have no PNR', bks.filter((b) => b.status === 'FAILED').every((b) => b.pnr === null));
  const pnrs = bks.filter((b) => b.pnr).map((b) => `${b.pcc}:${b.pnr}`);
  add('Unique provider/PCC/PNR', new Set(pnrs).size === pnrs.length);
  const claims = loadFixture('refunds.json').claims as any[];
  add('Each claim references a cancelled/voided booking of same agency', claims.every((c) => { const b = bks.find((x) => x.id === c.bookingId); return b && ['CANCELLED', 'VOIDED'].includes(b.status) && b.agencyId === c.agencyId; }));
  add('Claims copy booking-time refund policy', claims.every((c) => { const b = bks.find((x) => x.id === c.bookingId); return b.refundPolicyId === c.refundPolicyId && b.refundPolicyVersion === c.refundPolicyVersion && b.refundPayoutMode === c.refundPayoutMode; }));
  const pays = loadFixture('payments.json').events as any[];
  add('Unique payment external references', new Set(pays.map((p) => p.externalRef)).size === pays.length);
  const rowsFile = path.resolve('fixtures/reports/report-rows.json');
  if (fs.existsSync(rowsFile)) {
    const rr = JSON.parse(fs.readFileSync(rowsFile, 'utf8')).reports as Record<string, any[]>;
    const types = Object.keys(rr);
    add('Six report datasets', types.length === 6);
    add('Each report has exactly 100 rows', types.every((t) => rr[t].length === 100));
    add('Report scope 40/35/25 per agency', types.every((t) => ['agency_skyline:40', 'agency_orbit:35', 'agency_aster:25'].every((x) => { const [a, n] = x.split(':'); return rr[t].filter((r) => r.AgencyId === a).length === Number(n); })));
    add('Six XLSX binaries present', types.every((t) => fs.existsSync(path.resolve(`fixtures/reports/${t}.xlsx`))));
  } else add('Report fixtures built (run npm run reports:build)', false);
  const docsDir = path.resolve('fixtures/documents');
  add('Synthetic documents present', ['company-registration-demo.pdf', 'pan-card-demo.pdf', 'identity-masked-demo.pdf', 'unreadable-demo.png', 'extraction-expected.json'].every((f) => fs.existsSync(path.join(docsDir, f))));
  const chat = loadFixture('chatbot-scenarios.json');
  add('Chatbot main menu has 7 intents + language', chat.menu.length === 7 && chat.languages.length === 3);
  return out;
}

/** Verifies a seeded DB against the seed-contract oracle (requires anchor = DB anchor). */
export function validateSeededState(db: DB, anchorIso: string): Check[] {
  const out: Check[] = [];
  const contract = loadFixture('seed-contract.v1.json');
  const add = (name: string, ok: boolean, detail?: string) => out.push({ name, ok, detail });
  const count = (t: string) => Number((db.get(sql.raw(`SELECT count(*) AS n FROM "${t}"`)) as any).n);
  add('24 seeded bookings', count('bookings') === 24);
  add('6 refund claims', count('refund_claims') === 6);
  add('Exactly 2 fare profiles in DB', count('fare_rule_profiles') === 2);
  for (const [agencyId, exp] of Object.entries<any>(contract.agencyOpeningLedger)) {
    const p = fundingPosition(db, agencyId, anchorIso);
    const ok = p.walletCashMinor === exp.walletCashMinor && p.walletHoldMinor === exp.walletHoldMinor && p.availableWalletMinor === exp.availableWalletMinor && p.creditOutstandingMinor === exp.creditDrawMinor && p.creditHoldMinor === exp.creditHoldMinor && p.availableCreditBeforeBlockMinor === exp.creditAvailableBeforePolicyBlockMinor && p.availableCreditMinor === exp.creditAvailableEffectiveMinor && p.creditBlocked === exp.creditOverdueBlocked;
    add(`Opening ledger oracle ${agencyId}`, ok, JSON.stringify({ cash: p.walletCashMinor, hold: p.walletHoldMinor, credit: p.creditOutstandingMinor, avail: p.availableCreditMinor, blocked: p.creditBlocked }));
  }
  const k = kpisFor(db, {});
  const e = contract.expectedKpisAtFullSeedCohort;
  const pairs: [string, number, number][] = [
    ['openingTicketedCount', k.ticketedCount, e.openingTicketedCount], ['openingCancelledCount', k.cancelledCount, e.openingCancelledCount],
    ['openingVoidedCount', k.voidedCount, e.openingVoidedCount], ['openingPnrUnticketedCount', k.pnrUnticketedCount, e.openingPnrUnticketedCount],
    ['openingFailedCount', k.failedCount, e.openingFailedCount], ['grossBookingValueMinor', k.grossBookingValueMinor, e.grossBookingValueMinor],
    ['initialSupplierCostMinor', k.initialSupplierCostMinor, e.initialSupplierCostMinor], ['agencyRefundObligationMinor', k.agencyRefundObligationMinor, e.agencyRefundObligationMinor],
    ['agencyWalletRefundPaidMinor', k.agencyWalletRefundPaidMinor, e.agencyWalletRefundPaidMinor], ['agencyRefundPendingMinor', k.agencyRefundPendingMinor, e.agencyRefundPendingMinor],
    ['supplierExpectedRefundMinor', k.supplierExpectedRefundMinor, e.supplierExpectedRefundMinor], ['supplierReceivedRefundMinor', k.supplierReceivedRefundMinor, e.supplierReceivedRefundMinor],
    ['supplierReceivableMinor', k.supplierReceivableMinor, e.supplierReceivableMinor], ['retainedAgencySalesMinor', k.retainedAgencySalesMinor, e.retainedAgencySalesMinor],
    ['retainedSupplierCostMinor', k.retainedSupplierCostMinor, e.retainedSupplierCostMinor], ['netPlatformRevenueMinor', k.netPlatformRevenueMinor, e.netPlatformRevenueMinor],
    ['variableOperatingExpenseMinor', k.variableOperatingExpenseMinor, e.variableOperatingExpenseMinor], ['estimatedContributionMinor', k.estimatedContributionMinor, e.estimatedContributionMinor],
  ];
  for (const [n, got, want] of pairs) add(`KPI oracle ${n}`, got === want, `got ${got} want ${want}`);
  add('Cancellation rate 5/19 excludes void; void 1/19', k.cancelledCount === 5 && k.voidedCount === 1 && k.ticketedCount === 19);
  const dupPay = db.all(sql.raw(`SELECT external_ref, count(*) n FROM wallet_ledger_entries WHERE external_ref IS NOT NULL GROUP BY agency_id, external_ref HAVING n > 1`));
  add('No external payment ref credited twice', dupPay.length === 0);
  const dupRefund = db.all(sql.raw(`SELECT refund_id, count(*) n FROM wallet_ledger_entries WHERE type='REFUND_CREDIT' GROUP BY refund_id HAVING n > 1`));
  add('At most one wallet credit per refund claim', dupRefund.length === 0);
  const badTix = db.all(sql.raw(`SELECT t.id FROM tickets t JOIN bookings b ON b.id=t.booking_id WHERE b.booking_status IN ('PNR_CREATED','BOOKING_FAILED','TICKETING_FAILED')`));
  add('No ticket on unticketed/failed bookings', badTix.length === 0);
  return out;
}

/** Full validation: structure + seed an isolated temp DB at a fixed anchor and compare the oracle. */
export function validateAll(anchorIso = '2026-11-19T12:00:00.000Z'): Check[] {
  const checks = validateStructure();
  const tmp = path.join(os.tmpdir(), `hubfares-test-validate-${process.pid}.sqlite`);
  for (const f of [tmp, `${tmp}-wal`, `${tmp}-shm`]) if (fs.existsSync(f)) fs.rmSync(f);
  const h = openDb(tmp);
  try {
    seedDatabase(h.db, anchorIso);
    checks.push(...validateSeededState(h.db, anchorIso));
  } catch (e: any) {
    checks.push({ name: 'Seed into isolated DB', ok: false, detail: e.message });
  } finally { h.sqlite.close(); for (const f of [tmp, `${tmp}-wal`, `${tmp}-shm`]) if (fs.existsSync(f)) fs.rmSync(f); }
  return checks;
}
export { s };
