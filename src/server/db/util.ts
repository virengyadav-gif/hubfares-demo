import { eq } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import type { DB } from './client';
import { demoMetadata, auditEvents, domainEvents, notifications } from './schema';
import { nowIso } from '@/shared/time';

export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0] | DB;

export function getMeta(db: Tx, key: string): string | null {
  const row = db.select().from(demoMetadata).where(eq(demoMetadata.key, key)).get();
  return row ? row.value : null;
}
export function setMeta(db: Tx, key: string, value: string) {
  db.insert(demoMetadata).values({ key, value }).onConflictDoUpdate({ target: demoMetadata.key, set: { value } }).run();
}
/** Deterministic per-reset sequence (stable IDs across resets with the same actions). */
export function nextSeq(db: Tx, name: string, start = 1): number {
  const cur = getMeta(db, `seq:${name}`);
  const n = cur ? Number(cur) + 1 : start;
  setMeta(db, `seq:${name}`, String(n));
  return n;
}
export const pad = (n: number, w = 4) => String(n).padStart(w, '0');
export function nextId(db: Tx, prefix: string): string {
  return `${prefix}_${pad(nextSeq(db, prefix))}`;
}
export const uid = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export type Actor = { userId: string | null; role: string | null; agencyId?: string | null };

export function audit(db: Tx, actor: Actor, action: string, entityType: string, entityId: string, agencyId: string | null, metadata: Record<string, unknown> = {}) {
  db.insert(auditEvents).values({
    id: nextId(db, 'aud'), actorId: actor.userId, actorRole: actor.role, agencyId, action, entityType, entityId,
    metadataJson: JSON.stringify({ ...metadata, source: 'DEMO' }), occurredAt: nowIso(),
  }).run();
}
export function domainEvent(db: Tx, type: string, entityType: string, entityId: string, agencyId: string | null, payload: Record<string, unknown> = {}) {
  db.insert(domainEvents).values({ id: nextId(db, 'evt'), type, entityType, entityId, agencyId, payloadJson: JSON.stringify(payload), occurredAt: nowIso() }).run();
}
export function notify(db: Tx, n: { audience: 'AGENCY' | 'HUB'; agencyId?: string | null; userId?: string | null; kind: string; referenceId?: string | null; title: string; payload?: Record<string, unknown> }) {
  db.insert(notifications).values({
    id: nextId(db, 'ntf'), audience: n.audience, agencyId: n.agencyId ?? null, userId: n.userId ?? null, kind: n.kind,
    referenceId: n.referenceId ?? null, title: n.title, payloadJson: JSON.stringify(n.payload ?? {}), createdAt: nowIso(),
  }).run();
}
