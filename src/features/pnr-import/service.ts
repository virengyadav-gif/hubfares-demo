/** Offline PNR import (WF-14): authorised provider+PCC+PNR retrieve, then create once. No ticket issuance, no ledger posting. */
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import * as s from '@/server/db/schema';
import type { DB } from '@/server/db/client';
import { nextId, audit, domainEvent, notify, Tx } from '@/server/db/util';
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
const NOT_FOUND = 'No matching PNR found in the permitted demo records.';
const TZ: Record<string, string> = { BOM: 'Asia/Kolkata', DEL: 'Asia/Kolkata', BLR: 'Asia/Kolkata', GOI: 'Asia/Kolkata' };
const AIRLINE: Record<string, string> = { AI: 'Air India', '6E': 'IndiGo' };

function authorisedLookup(db: Tx, ctx: SessionCtx, i: z.infer<typeof lookupSchema>): { rec: ImportedPnr; agencyId: string } {
  const adapter = gdsAdapter(i.provider); // throws INTEGRATION_NOT_CONNECTED for Travelport/Amadeus
  const map = db.select().from(s.pccMappings).where(eq(s.pccMappings.pccCode, i.pcc)).get();
  if (!map || !map.enabled) throw new AppError('PNR_NOT_FOUND', NOT_FOUND);
  let agencyId: string;
  if (isHub(ctx)) {
    if (!i.targetAgencyId) throw new AppError('VALIDATION_ERROR', 'Select the target agency for this import');
    if (map.agencyId && map.agencyId !== i.targetAgencyId) throw new AppError('PNR_NOT_FOUND', NOT_FOUND);
    agencyId = i.targetAgencyId;
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
  return { provider: rec.provider, pcc: rec.pcc, gdsPnr: rec.pnr, airlinePnr: rec.airlinePnr, targetAgencyId: agencyId, itinerary: { ...rec.itinerary, departureAt: dep, arrivalAt: isoPlus(dep, rec.itinerary.durationMin * 60000), airlineName: AIRLINE[rec.itinerary.airlineCode] ?? rec.itinerary.airlineCode }, passengers: rec.passengers, ticketStatus: rec.ticketStatus, ticketNumbers: rec.ticketStatus === 'TICKETED' ? rec.ticketNumbers : [], fareRuleProfileId: rec.fareRuleProfileId, agencySellMinor: rec.agencySellMinor, alreadyImported: !!already, alreadyImportedBookingId: already?.bookingId ?? null, source: 'SIMULATED', providerMode: 'MOCK' };
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
    const id = nextId(tx, 'book_imp');
    const dep = offsetToIso(anchor, rec.itinerary.departureOffset);
    const ticketed = rec.ticketStatus === 'TICKETED';
    tx.insert(s.bookings).values({
      id, agencyId, quoteId: null, userId: ctx.userId, source: 'IMPORTED', provider: rec.provider, pcc: rec.pcc, tripType: 'ONE_WAY', segmentCount: 1,
      bookingStatus: ticketed ? 'TICKETED' : 'PNR_CREATED', ticketStatus: ticketed ? 'ISSUED' : 'PENDING', paymentStatus: 'NONE', fundingType: 'NONE',
      bookedAt: at, firstDepartureAt: dep, routeSummary: `${rec.itinerary.origin}-${rec.itinerary.destination}`, airlineSummary: rec.itinerary.airlineCode, leadPassenger: rec.passengers[0],
      sellAmountMinor: rec.agencySellMinor, supplierCostMinor: rec.supplierCostMinor, currency: 'INR', refundPolicyId: pol.id, refundPolicyVersion: pol.version, refundPayoutMode: refundCfg(pol).payoutMode,
      bookingSnapshotJson: JSON.stringify({ imported: true, originalGdsBookedAt: offsetToIso(anchor, rec.bookedOffset), passengers: { adults: rec.passengers.length, children: 0, infants: 0 }, refundPolicy: { id: pol.id, version: pol.version, payoutMode: refundCfg(pol).payoutMode, snapshotAt: 'IMPORT' }, note: 'Imported record — no new ticket issued and no wallet/credit posting by Hubfares' }),
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
