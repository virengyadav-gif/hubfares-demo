/** Offline PNR import (WF-14): authorised provider+PCC+PNR retrieve, then create once. No ticket issuance, no ledger posting. */
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { nextId, nextCode, audit, domainEvent, notify, Tx } from '@/server/db/util';
import { withIdempotency } from '@/server/idempotency';
import type { SessionCtx } from '@/server/auth/session';
import { isHub, requireActiveAgency } from '@/server/auth/authorize';
import { AppError } from '@/shared/errors';
import { nowIso, offsetToIso, isoPlus } from '@/shared/time';
import { gdsAdapter } from '@/server/providers/gds/sabre-mock';
import { getMeta } from '@/server/db/util';
import { effectivePolicy, refundCfg } from '@/features/wallet-credit/policies';
import type { ImportedPnr } from '@/server/providers/gds/types';

export const lookupSchema = z.object({ provider: z.enum(['SABRE', 'TRAVELPORT', 'AMADEUS']).default('SABRE'), pcc: z.string().trim().toUpperCase().min(3).max(10), pnr: z.string().trim().toUpperCase().min(5).max(8), targetAgencyId: z.string().optional() });
const NOT_FOUND = 'No matching PNR was found for your account.';
const TZ: Record<string, string> = { BOM: 'Asia/Kolkata', DEL: 'Asia/Kolkata', BLR: 'Asia/Kolkata', GOI: 'Asia/Kolkata' };
const AIRLINE: Record<string, string> = { AI: 'Air India', '6E': 'IndiGo' };

function authorisedLookup(db: Tx, ctx: SessionCtx, i: z.infer<typeof lookupSchema>): { rec: ImportedPnr; agencyId: string } {
  const adapter = gdsAdapter(i.provider); // throws INTEGRATION_NOT_CONNECTED for Travelport/Amadeus
  const map = db.select().from(s.pccMappings).where(eq(s.pccMappings.pccCode, i.pcc)).get();
  if (!map || !map.enabled) throw new AppError('PNR_NOT_FOUND', NOT_FOUND);
  let agencyId: string;
  if (isHub(ctx)) {
    const target = i.targetAgencyId || map.agencyId || adapter.retrievePnr(i.pnr, i.pcc)?.ownerAgencyId || null;
    if (!target) throw new AppError('VALIDATION_ERROR', 'Select the target agency for this import');
    if (map.agencyId && map.agencyId !== target) throw new AppError('PNR_NOT_FOUND', NOT_FOUND);
    agencyId = target;
  } else {
    if (map.agencyId && map.agencyId !== ctx.agencyId) throw new AppError('PNR_NOT_FOUND', NOT_FOUND);
    agencyId = ctx.agencyId!;
  }
  const rec = adapter.retrievePnr(i.pnr, i.pcc);
  if (!rec || (rec.ownerAgencyId && rec.ownerAgencyId !== agencyId) || (!isHub(ctx) && rec.ownerAgencyId !== agencyId)) throw new AppError('PNR_NOT_FOUND', NOT_FOUND);
  return { rec, agencyId };
}
export function lookupPnr(db: Tx, ctx: SessionCtx, i: z.infer<typeof lookupSchema>) {
  const { rec, agencyId } = authorisedLookup(db, ctx, i);
  const anchor = getMeta(db, 'anchorUtc')!;
  const already = db.select().from(s.pnrRecords).where(and(eq(s.pnrRecords.provider, rec.provider), eq(s.pnrRecords.pcc, rec.pcc), eq(s.pnrRecords.gdsPnr, rec.pnr))).get();
  const dep = offsetToIso(anchor, rec.itinerary.departureOffset);
  return { provider: isHub(ctx) ? rec.provider : undefined, pcc: rec.pcc, gdsPnr: rec.pnr, airlinePnr: rec.airlinePnr, targetAgencyId: agencyId, itinerary: { ...rec.itinerary, departureAt: dep, arrivalAt: isoPlus(dep, rec.itinerary.durationMin * 60000), airlineName: AIRLINE[rec.itinerary.airlineCode] ?? rec.itinerary.airlineCode }, passengers: rec.passengers, ticketStatus: rec.ticketStatus, ticketNumbers: rec.ticketStatus === 'TICKETED' ? rec.ticketNumbers : [], fareRuleProfileId: rec.fareRuleProfileId, agencySellMinor: rec.agencySellMinor, alreadyImported: !!already, alreadyImportedBookingId: already?.bookingId ?? null };
}
export const searchSchema = z.object({
  pcc: z.string().trim().toUpperCase().max(10).optional(), pnr: z.string().trim().toUpperCase().max(8).optional(),
  passenger: z.string().trim().max(60).optional(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  targetAgencyId: z.string().optional(),
});
/** Bulk retrieve: every field optional. Returns all PNRs the caller may import, narrowed by any filters given. */
export function searchPnrs(db: Tx, ctx: SessionCtx, f: z.infer<typeof searchSchema>) {
  const adapter = gdsAdapter('SABRE');
  const anchor = getMeta(db, 'anchorUtc')!;
  const maps = Object.fromEntries(db.select().from(s.pccMappings).all().map((m) => [m.pccCode, m]));
  const hub = isHub(ctx);
  const imported = db.select().from(s.pnrRecords).all();
  const target = hub ? f.targetAgencyId || null : ctx.agencyId!;
  const agencies = Object.fromEntries(db.select().from(s.agencies).all().map((a) => [a.id, a.displayName]));
  return adapter.listPnrs().filter((r) => {
    const m = maps[r.pcc];
    if (!m || !m.enabled) return false;
    if (!hub && (r.ownerAgencyId !== target || (m.agencyId && m.agencyId !== target))) return false;
    if (hub && target && ((r.ownerAgencyId && r.ownerAgencyId !== target) || (m.agencyId && m.agencyId !== target))) return false;
    if (f.pcc && r.pcc !== f.pcc) return false;
    if (f.pnr && !r.pnr.includes(f.pnr)) return false;
    if (f.passenger && !r.passengers.some((p) => p.toLowerCase().includes(f.passenger!.toLowerCase()))) return false;
    const dep = offsetToIso(anchor, r.itinerary.departureOffset).slice(0, 10);
    if (f.from && dep < f.from) return false;
    if (f.to && dep > f.to) return false;
    return true;
  }).map((r) => {
    const dep = offsetToIso(anchor, r.itinerary.departureOffset);
    const done = imported.find((p) => p.provider === r.provider && p.pcc === r.pcc && p.gdsPnr === r.pnr);
    const owner = r.ownerAgencyId ?? maps[r.pcc]?.agencyId ?? null;
    return { pcc: r.pcc, gdsPnr: r.pnr, airlinePnr: r.airlinePnr, ownerAgencyId: hub ? owner : undefined, ownerAgencyName: hub && owner ? agencies[owner] : undefined, provider: hub ? r.provider : undefined,
      itinerary: { ...r.itinerary, departureAt: dep, arrivalAt: isoPlus(dep, r.itinerary.durationMin * 60000), airlineName: AIRLINE[r.itinerary.airlineCode] ?? r.itinerary.airlineCode },
      passengers: r.passengers, ticketStatus: r.ticketStatus, ticketNumbers: r.ticketStatus === 'TICKETED' ? r.ticketNumbers : [], fareRuleProfileId: r.fareRuleProfileId, agencySellMinor: r.agencySellMinor,
      alreadyImported: !!done, alreadyImportedBookingId: done?.bookingId ?? null };
  }).sort((a, b) => a.itinerary.departureAt.localeCompare(b.itinerary.departureAt));
}
export const bulkSchema = z.object({ items: z.array(z.object({ pcc: z.string().trim().toUpperCase().min(3).max(10), pnr: z.string().trim().toUpperCase().min(5).max(8) })).min(1).max(50), targetAgencyId: z.string().optional() });
/** Import several PNRs; each one is idempotent and independent (one failure does not block the others). */
export function bulkImport(db: DB, ctx: SessionCtx, i: z.infer<typeof bulkSchema>, idemKey: string) {
  return i.items.map((it) => {
    try {
      const r = importPnr(db, ctx, { provider: 'SABRE', pcc: it.pcc, pnr: it.pnr, targetAgencyId: i.targetAgencyId }, `${idemKey}:${it.pcc}:${it.pnr}`);
      return { pcc: it.pcc, gdsPnr: it.pnr, status: 'IMPORTED' as const, bookingId: r.result.bookingId };
    } catch (e: any) {
      if (e instanceof AppError && e.code === 'PNR_ALREADY_IMPORTED') return { pcc: it.pcc, gdsPnr: it.pnr, status: 'ALREADY_IMPORTED' as const, bookingId: (e.details as any)?.bookingId ?? null, message: e.message };
      return { pcc: it.pcc, gdsPnr: it.pnr, status: 'FAILED' as const, bookingId: null, message: e instanceof AppError ? e.message : 'Import failed' };
    }
  });
}
export function importPnr(db: DB, ctx: SessionCtx, i: z.infer<typeof lookupSchema>, idemKey: string) {
  if (!isHub(ctx)) requireActiveAgency(ctx);
  return db.transaction((tx) => withIdempotency(tx, 'pnr.import', idemKey, { userId: ctx.userId, agencyId: ctx.agencyId }, i, () => {
    const { rec, agencyId } = authorisedLookup(tx, ctx, i);
    const dup = tx.select().from(s.pnrRecords).where(and(eq(s.pnrRecords.provider, rec.provider), eq(s.pnrRecords.pcc, rec.pcc), eq(s.pnrRecords.gdsPnr, rec.pnr))).get();
    if (dup) throw new AppError('PNR_ALREADY_IMPORTED', `PNR ${rec.pnr} is already imported (booking ${dup.bookingId}). No duplicate created.`, { bookingId: dup.bookingId });
    const at = nowIso();
    const anchor = getMeta(tx, 'anchorUtc')!;
    const pol = effectivePolicy(tx, agencyId, 'REFUND', at);
    if (!pol) throw new AppError('INVALID_STATE', 'No effective refund policy for the agency');
    const profile = tx.select().from(s.fareRuleProfiles).where(eq(s.fareRuleProfiles.id, rec.fareRuleProfileId)).get()!;
    const id = nextCode(tx, 'HFB', 3000);
    const dep = offsetToIso(anchor, rec.itinerary.departureOffset);
    const ticketed = rec.ticketStatus === 'TICKETED';
    tx.insert(s.bookings).values({
      id, agencyId, quoteId: null, userId: ctx.userId, source: 'IMPORTED', provider: rec.provider, pcc: rec.pcc, tripType: 'ONE_WAY', segmentCount: 1,
      bookingStatus: ticketed ? 'TICKETED' : 'PNR_CREATED', ticketStatus: ticketed ? 'ISSUED' : 'PENDING', paymentStatus: 'NONE', fundingType: 'NONE',
      bookedAt: at, firstDepartureAt: dep, routeSummary: `${rec.itinerary.origin}-${rec.itinerary.destination}`, airlineSummary: rec.itinerary.airlineCode, leadPassenger: rec.passengers[0],
      sellAmountMinor: rec.agencySellMinor, supplierCostMinor: rec.supplierCostMinor, currency: 'INR', refundPolicyId: pol.id, refundPolicyVersion: pol.version, refundPayoutMode: refundCfg(pol).payoutMode,
      bookingSnapshotJson: JSON.stringify({ imported: true, originalGdsBookedAt: offsetToIso(anchor, rec.bookedOffset), passengers: { adults: rec.passengers.length, children: 0, infants: 0 }, refundPolicy: { id: pol.id, version: pol.version, payoutMode: refundCfg(pol).payoutMode, snapshotAt: 'IMPORT' }, note: 'Imported record — no new ticket issued and no wallet/credit posting' }),
      updatedAt: at,
    }).run();
    tx.insert(s.bookingSegments).values({ id: `${id}_seg0`, bookingId: id, legIndex: 0, direction: 'OUTBOUND', flightOfferId: null, airline: rec.itinerary.airlineCode, airlineName: AIRLINE[rec.itinerary.airlineCode] ?? rec.itinerary.airlineCode, flightNumber: rec.itinerary.flightNumber, origin: rec.itinerary.origin, destination: rec.itinerary.destination, departureAt: dep, arrivalAt: isoPlus(dep, rec.itinerary.durationMin * 60000), originTz: TZ[rec.itinerary.origin] ?? 'Asia/Kolkata', destinationTz: TZ[rec.itinerary.destination] ?? 'Asia/Kolkata', cabin: rec.itinerary.cabin, fareBrandId: null, brandName: 'Imported', fareRuleProfileId: profile.id, profileVersion: profile.version, fareRuleSnapshotJson: profile.dataJson, segmentSellMinor: rec.agencySellMinor, segmentSupplierCostMinor: rec.supplierCostMinor, priceComponentsJson: JSON.stringify({ imported: true }) }).run();
    rec.passengers.forEach((p, n) => tx.insert(s.passengers).values({ id: `${id}_pax${n + 1}`, bookingId: id, displayName: p, travelerType: 'ADULT', maskedDocReference: null }).run());
    tx.insert(s.pnrRecords).values({ id: `${id}_pnr`, bookingId: id, provider: rec.provider, pcc: rec.pcc, gdsPnr: rec.pnr, airlinePnr: rec.airlinePnr, imported: true, createdAt: at }).run();
    if (ticketed) rec.ticketNumbers.forEach((t, n) => tx.insert(s.tickets).values({ id: `${id}_tkt${n + 1}`, bookingId: id, passengerId: `${id}_pax${n + 1}`, ticketNumber: t, issuedAt: offsetToIso(anchor, rec.bookedOffset), status: 'ISSUED', imported: true }).run());
    audit(tx, { userId: ctx.userId, role: ctx.role }, 'PNR_IMPORTED', 'booking', id, agencyId, { provider: rec.provider, pcc: rec.pcc, pnr: rec.pnr });
    domainEvent(tx, 'booking.imported', 'booking', id, agencyId, { pnr: rec.pnr });
    notify(tx, { audience: 'AGENCY', agencyId, kind: 'PNR_IMPORTED', referenceId: id, title: `PNR ${rec.pnr} imported as ${id}` });
    return { bookingId: id, agencyId, gdsPnr: rec.pnr, ticketStatus: ticketed ? 'ISSUED' : 'PENDING', ledgerPosted: false };
  }));
}
