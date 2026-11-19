// CLI demo reset: guard → reseed → validate oracle. Fails closed (non-zero exit) on any check failure.
import { openDb, dbFilePath } from '../src/server/db/client';
import { seedDatabase, anchorForSeed, FIXTURE_VERSION } from '../src/server/db/seed';
import { assertDemoDbAllowed, assertResetEnabled } from '../src/server/db/guard';
import { validateSeededState } from '../src/server/db/validate';

const file = dbFilePath();
assertResetEnabled();
assertDemoDbAllowed(file);
const h = openDb(file);
const anchor = anchorForSeed();
seedDatabase(h.db, anchor);
const checks = validateSeededState(h.db, anchor);
h.sqlite.close();
const bad = checks.filter((c) => !c.ok);
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
if (bad.length) { console.error(`Reset FAILED: ${bad.length} check(s) failed. Do not present.`); process.exit(1); }
console.log(`Reset OK: ${FIXTURE_VERSION} into ${file} (anchor ${anchor}). ${checks.length}/${checks.length} oracle checks pass.`);
