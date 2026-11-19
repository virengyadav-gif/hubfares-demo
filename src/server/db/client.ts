/** Single SQLite connection (WAL + FK). The DB file path comes from DATABASE_URL. */
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

export type DB = BetterSQLite3Database<typeof schema>;
type Holder = { db: DB; sqlite: Database.Database; file: string };
const g = globalThis as unknown as { __hubfaresDb?: Holder };

export function dbFilePath(): string {
  const url = process.env.DATABASE_URL || 'file:./data/hubfares-demo.sqlite';
  const p = url.replace(/^file:/, '');
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}
export function migrationsFolder(): string {
  return path.resolve(process.cwd(), 'src/server/db/migrations');
}
export function openDb(file: string): Holder {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrationsFolder() });
  return { db, sqlite, file };
}
export function getDb(): DB {
  const file = dbFilePath();
  if (!g.__hubfaresDb || g.__hubfaresDb.file !== file) {
    if (g.__hubfaresDb) g.__hubfaresDb.sqlite.close();
    g.__hubfaresDb = openDb(file);
  }
  return g.__hubfaresDb.db;
}
export function closeDb() {
  if (g.__hubfaresDb) { g.__hubfaresDb.sqlite.close(); g.__hubfaresDb = undefined; }
}
export { schema };
