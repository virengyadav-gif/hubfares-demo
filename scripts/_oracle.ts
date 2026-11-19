// Dev helper: seed a temp DB at the fixed anchor and print KPI + ledger values for the contract.
import fs from 'node:fs';
import { openDb } from '../src/server/db/client';
import { seedDatabase } from '../src/server/db/seed';
import { kpisFor } from '../src/features/executive/kpis';
import { fundingPosition } from '../src/features/wallet-credit/position';
import { overview } from '../src/features/executive/service';
const f = '/tmp/hubfares-test-oracle.sqlite'; for (const x of [f, f + '-wal', f + '-shm']) if (fs.existsSync(x)) fs.rmSync(x);
const h = openDb(f); const A = '2026-11-19T12:00:00.000Z';
seedDatabase(h.db, A);
const k = kpisFor(h.db, {});
console.log(JSON.stringify(k));
for (const a of ['agency_skyline', 'agency_orbit', 'agency_aster']) { const p = fundingPosition(h.db, a, A); console.log(a, JSON.stringify({ cash: p.walletCashMinor, hold: p.walletHoldMinor, avail: p.availableWalletMinor, credit: p.creditOutstandingMinor, chold: p.creditHoldMinor, cavailB: p.availableCreditBeforeBlockMinor, cavail: p.availableCreditMinor, blocked: p.creditBlocked })); }
for (const a of overview(h.db, {}).byAgency) console.log(a.agencyName, 'net', a.netPlatformRevenueMinor / 100, 'contrib', a.estimatedContributionMinor / 100);
