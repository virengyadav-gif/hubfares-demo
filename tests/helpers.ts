import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { closeDb, getDb } from '@/server/db/client';
import { seedDatabase } from '@/server/db/seed';
import { setClockOverride } from '@/shared/time';
import { login } from '@/server/auth/session';

export const ANCHOR = '2026-11-19T12:00:00.000Z';
export const PW = 'Hubfares@Demo2026';
export const U = { super: 'superadmin@hubfares.example.com', fin: 'finance@hubfares.example.com', ops: 'ops@hubfares.example.com', cxo: 'cxo@hubfares.example.com', skyA: 'admin@skyline.example.com', sky: 'agent@skyline.example.com', orbA: 'admin@orbit.example.com', orb: 'agent@orbit.example.com', astA: 'admin@aster.example.com', astF: 'finance@aster.example.com' };
let n = 0;
/** Fresh isolated SQLite per suite (never the demo DB). */
export function freshDb() {
  const file = path.join(os.tmpdir(), `hubfares-test-${process.pid}-${Date.now()}-${n++}.sqlite`);
  for (const f of [file, `${file}-wal`, `${file}-shm`]) if (fs.existsSync(f)) fs.rmSync(f);
  process.env.DATABASE_URL = `file:${file}`;
  closeDb();
  setClockOverride(ANCHOR);
  const db = getDb();
  seedDatabase(db, ANCHOR);
  return db;
}
const tokens: Record<string, string> = {};
export function tokenFor(email: string) { const { token } = login(getDb(), email, PW); tokens[email] = token; return token; }
type H = (req: Request, rc?: any) => Promise<Response>;
export async function call(h: H, o: { method?: string; url?: string; as?: string | null; body?: unknown; idem?: string; params?: Record<string, string>; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(o.headers ?? {}) };
  if (o.as) headers.cookie = `hf_session=${tokens[o.as] ?? tokenFor(o.as)}`;
  if (o.idem) headers['idempotency-key'] = `idem-key-${o.idem}`;
  const method = o.method ?? (o.body !== undefined ? 'POST' : 'GET');
  const res = await h(new Request(`http://localhost${o.url ?? '/api/v1/x'}`, { method, headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined }), { params: Promise.resolve(o.params ?? {}) });
  const ct = res.headers.get('content-type') ?? '';
  const json = ct.includes('json') ? await res.json() : null;
  return { status: res.status, json, data: json?.data, error: json?.error, res };
}
export function resetTokens() { for (const k of Object.keys(tokens)) delete tokens[k]; }
export const rupees = (minor: number) => minor / 100;
