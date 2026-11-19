import { validateAll } from '../src/server/db/validate';
const checks = validateAll();
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${!c.ok && c.detail ? `  (${c.detail})` : ''}`);
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
