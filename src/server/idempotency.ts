/** Idempotency persistence: same key + same payload → stored result; same key + different payload → 409. Must run inside the mutation transaction. */
import { and, eq } from 'drizzle-orm';
import { idempotencyKeys } from './db/schema';
import { sha256, nextId, Tx } from './db/util';
import { nowIso } from '@/shared/time';
import { AppError } from '@/shared/errors';

export function withIdempotency<T>(tx: Tx, operation: string, key: string, actor: { userId: string | null; agencyId: string | null }, payload: unknown, fn: () => T): { result: T; replay: boolean } {
  const scopedKey = `${actor.agencyId ?? 'hub'}:${key}`;
  const fingerprint = sha256(JSON.stringify(payload ?? null));
  const existing = tx.select().from(idempotencyKeys).where(and(eq(idempotencyKeys.operation, operation), eq(idempotencyKeys.key, scopedKey))).get();
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new AppError('IDEMPOTENCY_CONFLICT', 'This Idempotency-Key was already used with a different request payload');
    return { result: JSON.parse(existing.resultJson) as T, replay: true };
  }
  const result = fn();
  tx.insert(idempotencyKeys).values({ id: nextId(tx, 'idem'), operation, key: scopedKey, actorId: actor.userId, agencyId: actor.agencyId, fingerprint, resultJson: JSON.stringify(result), createdAt: nowIso() }).run();
  return { result, replay: false };
}
