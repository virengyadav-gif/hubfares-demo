// HTTP smoke against a running server (default http://localhost:3000): login, wallet, executive overview, reports catalog.
const base = process.env.SMOKE_URL ?? 'http://localhost:3000';
const pw = process.env.DEMO_PASSWORD ?? 'Hubfares@Demo2026';
async function login(email: string) {
  const r = await fetch(`${base}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ email, password: pw }) });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return (r.headers.get('set-cookie') ?? '').split(';')[0];
}
async function get(cookie: string, p: string) {
  const r = await fetch(`${base}${p}`, { headers: { cookie } });
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  GET ${p} → ${r.status}`);
  return r.ok;
}
(async () => {
  let ok = true;
  const ota = await login('admin@skyline.example.com');
  ok = (await get(ota, '/api/v1/wallet')) && ok;
  ok = (await get(ota, '/api/v1/reports/catalog')) && ok;
  const exec = await login('cxo@hubfares.example.com');
  ok = (await get(exec, '/api/v1/executive/overview')) && ok;
  ok = (await get(exec, '/api/v1/demo/status')) && ok;
  if (!ok) process.exit(1);
  console.log('Smoke OK');
})().catch((e) => { console.error(e); process.exit(1); });
