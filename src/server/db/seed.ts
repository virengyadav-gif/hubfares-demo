/**
 * Canonical seed (Data & Mocks §8.3 deterministic derived-record algorithm). Used by `npm run seed`,
 * `npm run demo:reset`, the protected reset API and isolated test databases. One transaction: fail closed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import type { DB } from './client';
import * as s from './schema';
import { offsetToIso, isoPlus, DAY } from '@/shared/time';
import { zonedToUtcIso, localYmd, addDaysYmd } from '@/shared/time/zones';
import { computeCancellation } from '@/features/refunds/calc';
import type { FareRuleProfile } from '@/features/fares/rules';
import { setMeta } from './util';

export const FIXTURE_VERSION = 'hubfares-v1.2-seed-003';
export const COST_MODEL_PER_TICKET_MINOR = 3500; // Data & Mocks §8.3 rule 6: INR 35 per historically ticketed booking

const fixturesDir = () => path.resolve(process.cwd(), 'fixtures');
export function loadFixture<T = any>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir(), name), 'utf8')) as T;
}

/** Child-first order so FK constraints hold while clearing. */
const CLEAR_ORDER = [
  'idempotency_keys', 'approval_requests', 'notifications', 'audit_events', 'domain_events', 'case_events', 'support_cases', 'support_conversations',
  'amendment_cases', 'supplier_settlement_events', 'refund_claims', 'cancellations', 'payment_matches', 'payment_events',
  'credit_ledger_entries', 'wallet_ledger_entries', 'funding_reservations', 'modeled_costs', 'tickets', 'pnr_records', 'passengers',
  'booking_segments', 'bookings', 'quote_segments', 'quotes', 'fare_brands', 'flight_offers', 'fare_rule_profiles', 'pcc_mappings',
  'suppliers', 'providers', 'advanced_commercial_drafts', 'core_commercial_rules', 'agency_markup_ui_rules', 'agency_policies',
  'kyc_checks', 'document_extractions', 'uploaded_documents', 'registration_applications', 'sessions', 'user_permissions', 'users',
  'agencies', 'fx_demo_rates', 'demo_metadata',
];

export function seedDatabase(db: DB, anchorIso: string, opts: { preserveSessions?: boolean; resetCount?: number } = {}) {
  const A = (off: string) => offsetToIso(anchorIso, off);
  const contract = loadFixture('seed-contract.v1.json');
  if (contract.fixtureVersion !== FIXTURE_VERSION) throw new Error('Fixture version mismatch');
  const agenciesFx = loadFixture('agencies.json');
  const usersFx = loadFixture('users.json');
  const policiesFx = loadFixture('policies.json');
  const profiles: FareRuleProfile[] = loadFixture('fare-rules.json');
  const flights = loadFixture('flights.json');
  const core = loadFixture('core-commercial-rules.json');
  const markup = loadFixture('downstream-markup-ui.json');
  const adv = loadFixture('advanced-commercial-drafts.json');
  const fx = loadFixture('fx-rates.json');
  const bookingsFx = loadFixture('bookings.json');
  const refundsFx = loadFixture('refunds.json');
  const paymentsFx = loadFixture('payments.json');
  const casesFx = loadFixture('support-cases.json');
  const guided = loadFixture('guided-samples.json');
  if (profiles.length !== 2) throw new Error('Exactly two fare-rule profiles required');
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const policyTerm: Record<string, number> = { agency_skyline: 0, agency_orbit: 7, agency_aster: 1 };

  db.transaction((tx) => {
    const keptSessions = opts.preserveSessions ? tx.select().from(s.sessions).all().filter((x) => !x.revokedAt) : [];
    for (const t of CLEAR_ORDER) tx.run(sql.raw(`DELETE FROM "${t}"`));

    // ---- metadata ----
    const manifest = { fixtureVersion: FIXTURE_VERSION, schemaAuthority: 'docs/02_TECHNICAL_DESIGN.md', productAuthority: 'docs/01_PRODUCT_SPEC.md', dataAuthority: 'docs/03_DEMO_DATA_AND_MOCKS.md', seedMode: 'MOCK', currency: 'INR', source: 'SYNTHETIC_DEMO', fareProfileIds: ['A_FLEXIBLE', 'B_RESTRICTED'], reportSnapshotType: 'FROZEN_SAMPLE' };
    setMeta(tx, 'manifest', JSON.stringify(manifest));
    setMeta(tx, 'fixtureVersion', FIXTURE_VERSION);
    setMeta(tx, 'anchorUtc', anchorIso);
    setMeta(tx, 'clockMode', process.env.DEMO_CLOCK_MODE === 'fixed' ? 'fixed' : 'system');
    setMeta(tx, 'costModelPerTicketMinor', String(COST_MODEL_PER_TICKET_MINOR));
    setMeta(tx, 'resetCount', String(opts.resetCount ?? 0));
    setMeta(tx, 'seededAt', anchorIso);

    // ---- reference data ----
    for (const p of profiles) tx.insert(s.fareRuleProfiles).values({ id: p.id, version: p.version, currency: p.currency, dataJson: JSON.stringify(p) }).run();
    for (const r of fx.rates) tx.insert(s.fxDemoRates).values({ id: `fx_${r.quoteCurrency.toLowerCase()}`, baseCurrency: 'INR', quoteCurrency: r.quoteCurrency, inrPerUnit: r.inrPerUnit, effectiveDate: fx.effectiveDate, source: fx.source }).run();
    for (const p of agenciesFx.providers) tx.insert(s.providers).values(p).run();
    for (const p of agenciesFx.suppliers) tx.insert(s.suppliers).values(p).run();
    for (const a of agenciesFx.agencies) {
      tx.insert(s.agencies).values({ id: a.id, legalName: a.legalName, displayName: a.displayName, status: a.status, country: 'IN', city: a.city, state: a.state, panMasked: a.panMasked, gstin: a.gstin, contactEmail: a.contactEmail, registeredAt: A(a.registeredOffset), activatedAt: A(a.activatedOffset) }).run();
    }
    for (const p of agenciesFx.pccMappings) tx.insert(s.pccMappings).values(p).run();
    for (const u of usersFx.users) {
      tx.insert(s.users).values({ id: u.id, agencyId: u.agencyId, name: u.name, email: u.email, mobile: u.mobile, role: u.role, status: u.status, passwordHash: u.passwordHash, createdAt: A('D-90') }).run();
      for (const [k, v] of Object.entries(u.permissions ?? {})) tx.insert(s.userPermissions).values({ id: `perm_${u.id}_${k}`, userId: u.id, permissionKey: k, allowed: !!v }).run();
    }
    const seededUserIds = new Set(usersFx.users.map((u: any) => u.id));
    for (const k of keptSessions) if (seededUserIds.has(k.userId)) tx.insert(s.sessions).values(k).run();
    for (const p of policiesFx.policies) {
      tx.insert(s.agencyPolicies).values({ id: p.id, agencyId: p.agencyId, type: p.type, version: p.version, effectiveFrom: A(p.effectiveOffset), effectiveUntil: p.effectiveUntilOffset ? A(p.effectiveUntilOffset) : null, enabled: true, configJson: JSON.stringify(p.config), createdBy: 'user_hub_finance', createdAt: A(p.effectiveOffset) }).run();
    }
    for (const r of core) {
      tx.insert(s.coreCommercialRules).values({ id: r.id, label: r.label, agencyId: r.agencyId, airlineCode: r.airlineCode, origin: r.origin, destination: r.destination, fixedFeeMinor: r.fixedFeeMinor, percentBps: r.percentBps, disclosedServiceFeeMinor: r.disclosedServiceFeeMinor, percentageBase: 'SUPPLIER_BASE', rebateMinor: r.rebateMinor, priority: r.priority, enabled: r.enabled, effectiveFrom: A(r.effectiveOffset), effectiveUntil: null, ruleVersion: r.ruleVersion, historyJson: '[]', updatedAt: A(r.effectiveOffset) }).run();
    }
    for (const m of markup) {
      tx.insert(s.agencyMarkupUiRules).values({ id: m.id, agencyId: m.agencyId, name: m.name, journey: m.journey, tripTypesJson: JSON.stringify(m.tripTypes), airlineFilter: m.airlineFilter, cabinFilter: m.cabinFilter, markupKind: m.markupKind, value: m.value, currency: m.currency, targetUserIdsJson: JSON.stringify(m.targetUserIds), enabled: m.enabled, updatedAt: A('D-10') }).run();
    }
    for (const d of adv) {
      tx.insert(s.advancedCommercialDrafts).values({ id: d.id, ruleName: d.ruleName, headerJson: JSON.stringify(d.header), criteriaJson: JSON.stringify(d.criteria), expressionLinesJson: JSON.stringify(d.lines), priority: d.priority, enabled: d.enabled, draftRevision: d.draftRevision, historyJson: JSON.stringify(d.history.map((h: any) => ({ ...h, at: A(h.at) }))), updatedAt: A(d.history[d.history.length - 1].at) }).run();
    }

    // ---- flight offers: departure = (anchor date in origin tz) + dayOffset at local time ----
    for (const o of flights.offers) {
      const oTz = flights.airports[o.origin].tz, dTz = flights.airports[o.destination].tz;
      const depYmd = addDaysYmd(localYmd(anchorIso, oTz), o.dayOffset);
      const dep = zonedToUtcIso(depYmd, o.localDepartureTime, oTz);
      tx.insert(s.flightOffers).values({
        id: o.id, providerCode: o.providerCode, airlineCode: o.airlineCode, airlineName: o.airlineName, operatingCarrier: o.operatingCarrier, flightNumber: o.flightNumber,
        origin: o.origin, destination: o.destination, originCity: flights.airports[o.origin].city, destinationCity: flights.airports[o.destination].city,
        searchOriginCity: o.searchOriginCity, searchDestinationCity: o.searchDestinationCity, departureAt: dep, arrivalAt: isoPlus(dep, o.durationMin * 60000),
        originTz: oTz, destinationTz: dTz, durationMin: o.durationMin, cabin: o.cabin, stops: o.stops, via: o.via, seatsLeft: o.seatsLeft, aircraft: o.aircraft, international: o.international,
      }).run();
      for (const b of o.brands) {
        tx.insert(s.fareBrands).values({ id: b.id, offerId: o.id, brandCode: b.brandCode, brandName: b.brandName, fareClass: b.fareClass, supplierBaseMinor: b.supplierBaseMinor, supplierTaxMinor: b.supplierTaxMinor, refundableLabel: b.refundableLabel, baggageJson: JSON.stringify(b.baggage), meal: b.meal, ruleProfileId: b.ruleProfileId }).run();
      }
    }

    // ---- opening wallet ledger ----
    for (const [agencyId, l] of Object.entries<any>(contract.agencyOpeningLedger)) {
      const hp = (paymentsFx.historicalCredited ?? []).find((x: any) => x.agencyId === agencyId);
      tx.insert(s.walletLedgerEntries).values({ id: `wle_open_${agencyId}`, agencyId, type: hp ? 'PAYMENT_CREDIT' : 'OPENING', direction: 'CREDIT', amountMinor: l.openingWalletCreditMinor, currency: 'INR', externalRef: hp?.externalRef ?? null, description: hp ? `Bank transfer ${hp.externalRef} · matched to ${hp.agencyHint}` : 'Opening balance', idempotencyKey: `seed:opening:${agencyId}`, createdAt: A(hp?.receivedOffset ?? 'D-30') }).run();
      if (hp) {
        tx.insert(s.paymentEvents).values({ id: hp.id, providerCode: paymentsFx.bankProvider, agencyId, agencyHint: hp.agencyHint, externalPaymentRef: hp.externalRef, grossAmountMinor: l.openingWalletCreditMinor, currency: 'INR', status: 'CREDITED', receivedAt: A(hp.receivedOffset), matchingJson: JSON.stringify({ reason: `Matched to virtual account ${hp.agencyHint}`, matchedBy: 'AUTO' }) }).run();
        tx.insert(s.paymentMatches).values({ id: `pm_${hp.id}`, paymentEventId: hp.id, agencyId, status: 'CREDITED', matchedAt: A(hp.receivedOffset), matchedBy: 'AUTO_MATCHER', ledgerEntryId: `wle_open_${agencyId}` }).run();
      }
    }

    // ---- 24 historical bookings ----
    const claimsById = Object.fromEntries(refundsFx.claims.map((c: any) => [c.id, c]));
    for (const b of bookingsFx.bookings) {
      const bookedAt = A(b.bookedOffset);
      const dep = A(b.departureOffset);
      const arr = isoPlus(dep, b.durationMin * 60000);
      const profile = profileById[b.fareRuleProfileId];
      const ticketed = ['TICKETED', 'CANCELLED', 'VOIDED', 'IMPORTED_TICKETED'].includes(b.status);
      const statusMap: Record<string, [string, string, string]> = {
        TICKETED: ['TICKETED', 'ISSUED', 'CHARGED'], IMPORTED_TICKETED: ['TICKETED', 'ISSUED', 'CHARGED'],
        CANCELLED: ['CANCELLED', 'CANCELLED', claimsById[b.refundClaimId]?.walletCreditedMinor > 0 ? 'REFUNDED' : 'REFUND_PENDING'],
        VOIDED: ['VOIDED', 'VOIDED', 'REFUNDED'], PNR_CREATED: ['PNR_CREATED', 'PENDING', 'HELD'], FAILED: ['BOOKING_FAILED', 'NOT_ISSUED', 'NONE'],
      };
      const [bookingStatus, ticketStatus, paymentStatus] = statusMap[b.status];
      const funding = b.funding.startsWith('WALLET') ? 'WALLET' : b.funding.startsWith('CREDIT') ? 'CREDIT' : 'NONE';
      tx.insert(s.bookings).values({
        id: b.id, agencyId: b.agencyId, quoteId: null, userId: null, source: b.source, provider: b.provider, pcc: b.pcc, tripType: 'ONE_WAY', segmentCount: 1,
        bookingStatus, ticketStatus, paymentStatus, fundingType: funding, bookedAt, firstDepartureAt: dep, routeSummary: `${b.origin}-${b.destination}`,
        airlineSummary: b.airlineCode, leadPassenger: b.passengerName, sellAmountMinor: b.sellMinor, supplierCostMinor: b.supplierCostMinor, currency: 'INR',
        refundPolicyId: b.refundPolicyId, refundPolicyVersion: b.refundPolicyVersion, refundPayoutMode: b.refundPayoutMode,
        failureReason: b.status === 'FAILED' ? 'Airline did not confirm the booking — no funds charged' : null,
        bookingSnapshotJson: JSON.stringify({ historicalSeed: true, baseFareSnapshot: b.baseFareSnapshot, fundingAtBooking: b.funding, fareRuleProfileId: b.fareRuleProfileId, refundPolicy: { id: b.refundPolicyId, version: b.refundPolicyVersion, payoutMode: b.refundPayoutMode }, passengers: { adults: b.passengers, children: 0, infants: 0 } }),
        updatedAt: bookedAt,
      }).run();
      tx.insert(s.bookingSegments).values({
        id: `${b.id}_seg0`, bookingId: b.id, legIndex: 0, direction: 'OUTBOUND', flightOfferId: null, airline: b.airlineCode, airlineName: b.airlineName, flightNumber: b.flightNumber,
        origin: b.origin, destination: b.destination, departureAt: dep, arrivalAt: arr, originTz: b.originTz, destinationTz: b.destinationTz, cabin: b.cabin,
        fareBrandId: null, brandName: b.brandCode.charAt(0) + b.brandCode.slice(1).toLowerCase(), fareRuleProfileId: b.fareRuleProfileId, profileVersion: b.fareRuleProfileVersion,
        fareRuleSnapshotJson: JSON.stringify(profile), segmentSellMinor: b.sellMinor, segmentSupplierCostMinor: b.supplierCostMinor,
        priceComponentsJson: JSON.stringify({ supplierBaseMinor: b.baseFareSnapshot.supplierBaseMinor, supplierTaxMinor: b.baseFareSnapshot.supplierTaxMinor, historicalCoreFeeMinor: b.baseFareSnapshot.historicalCoreFeeMinor, perAdult: !!b.baseFareSnapshot.perAdult, adults: b.passengers }),
      }).run();
      const paxNames: string[] = b.passengerNames ?? [b.passengerName];
      paxNames.forEach((n, i) => tx.insert(s.passengers).values({ id: `${b.id}_pax${i + 1}`, bookingId: b.id, displayName: n, travelerType: 'ADULT', maskedDocReference: null }).run());
      if (b.pnr) tx.insert(s.pnrRecords).values({ id: `${b.id}_pnr`, bookingId: b.id, provider: b.provider, pcc: b.pcc, gdsPnr: b.pnr, airlinePnr: null, imported: b.source === 'IMPORTED', createdAt: bookedAt }).run();
      if (ticketed) {
        const tks: string[] = b.ticketNumbers ?? [b.ticketNumber];
        tks.forEach((t, i) => tx.insert(s.tickets).values({ id: i === 0 ? `${b.id}_tkt` : `${b.id}_tkt${i + 1}`, bookingId: b.id, passengerId: `${b.id}_pax${i + 1}`, ticketNumber: t, issuedAt: bookedAt, status: ticketStatus === 'ISSUED' ? 'ISSUED' : ticketStatus, imported: b.source === 'IMPORTED' }).run());
        tx.insert(s.modeledCosts).values({ id: `${b.id}_cost`, bookingId: b.id, agencyId: b.agencyId, kind: 'VARIABLE_PROCESSING', amountMinor: COST_MODEL_PER_TICKET_MINOR, createdAt: bookedAt }).run();
        if (funding === 'WALLET') {
          tx.insert(s.walletLedgerEntries).values({ id: `wle_${b.id}`, agencyId: b.agencyId, type: 'BOOKING_DEBIT', direction: 'DEBIT', amountMinor: b.sellMinor, currency: 'INR', bookingId: b.id, description: `Ticket ${b.ticketNumber}${b.passengers > 1 ? ` +${b.passengers - 1}` : ''} · ${b.origin}-${b.destination}`, idempotencyKey: `seed:book:${b.id}`, createdAt: bookedAt }).run();
        } else {
          tx.insert(s.creditLedgerEntries).values({ id: `cle_${b.id}`, agencyId: b.agencyId, type: 'DRAW', direction: 'DRAW', amountMinor: b.sellMinor, bookingId: b.id, dueAt: isoPlus(bookedAt, policyTerm[b.agencyId] * DAY), description: `Credit draw · ticket ${b.ticketNumber}`, idempotencyKey: `seed:book:${b.id}`, createdAt: bookedAt }).run();
        }
        tx.insert(s.fundingReservations).values({ id: `res_${b.id}`, agencyId: b.agencyId, bookingId: b.id, walletHoldMinor: funding === 'WALLET' ? b.sellMinor : 0, creditHoldMinor: funding === 'CREDIT' ? b.sellMinor : 0, status: 'CONSUMED', createdAt: bookedAt, expiresAt: isoPlus(bookedAt, DAY), updatedAt: bookedAt }).run();
      } else if (b.status === 'PNR_CREATED') {
        tx.insert(s.fundingReservations).values({ id: `res_${b.id}`, agencyId: b.agencyId, bookingId: b.id, walletHoldMinor: funding === 'WALLET' ? b.sellMinor : 0, creditHoldMinor: funding === 'CREDIT' ? b.sellMinor : 0, status: 'ACTIVE', createdAt: bookedAt, expiresAt: isoPlus(dep, -DAY), updatedAt: bookedAt }).run();
      }
    }

    // ---- historical cancellations & claims (recomputed from booked snapshot at confirmation instant; must equal contract) ----
    for (const c of refundsFx.claims) {
      const b = bookingsFx.bookings.find((x: any) => x.id === c.bookingId);
      const confirmedAt = A(c.confirmedOffset);
      const isVoid = b.status === 'VOIDED';
      const q = computeCancellation([{ legIndex: 0, origin: b.origin, destination: b.destination, departureAt: A(b.departureOffset), segmentSellMinor: b.sellMinor, segmentSupplierCostMinor: b.supplierCostMinor, profile: profileById[b.fareRuleProfileId], adults: 1 }], Date.parse(confirmedAt));
      const agencyRefund = isVoid ? b.sellMinor : q.estimatedAgencyRefundMinor;
      const supplierExpected = isVoid ? b.supplierCostMinor : q.supplierExpectedMinor;
      if (agencyRefund !== c.agencyRefundMinor || supplierExpected !== c.supplierExpectedMinor) {
        throw new Error(`Seed claim ${c.id} does not reconcile: computed ${agencyRefund}/${supplierExpected} vs contract ${c.agencyRefundMinor}/${c.supplierExpectedMinor}`);
      }
      const breakdown = isVoid ? [{ legIndex: 0, route: `${b.origin}-${b.destination}`, slab: 'VOID', supplierPenaltyMinor: 0, serviceFeeMinor: 0, segmentRefundMinor: b.sellMinor, supplierExpectedMinor: b.supplierCostMinor, profileId: b.fareRuleProfileId }] : q.segments;
      const cxl = `cxl_${b.id}`;
      tx.insert(s.cancellations).values({ id: cxl, bookingId: b.id, agencyId: b.agencyId, mode: isVoid ? 'VOID' : 'CANCEL', quoteSnapshotJson: JSON.stringify({ ...q, mode: isVoid ? 'VOID' : 'CANCEL', confirmedAt }), segmentSlabBreakdownJson: JSON.stringify(breakdown), estimatedRefundMinor: agencyRefund, status: 'CONFIRMED', idempotencyKey: `seed:cancel:${b.id}`, requestedAt: confirmedAt, requestedBy: null }).run();
      const payout = c.walletCreditedMinor > 0 ? 'CREDITED' : c.agencyRefundMinor === 0 ? 'NOT_APPLICABLE' : 'PENDING';
      const supplierStatus = c.supplierExpectedMinor === 0 ? 'NOT_APPLICABLE' : c.supplierReceivedMinor >= c.supplierExpectedMinor ? 'RECEIVED' : 'PENDING';
      const timeline: any[] = [{ at: confirmedAt, status: 'REQUESTED' }, { at: confirmedAt, status: 'APPROVED', note: `Policy ${c.refundPolicyId} v${c.refundPolicyVersion} (${c.refundPayoutMode}) from booking snapshot` }];
      if (payout === 'CREDITED') timeline.push({ at: confirmedAt, status: 'WALLET_CREDITED', amountMinor: c.walletCreditedMinor });
      tx.insert(s.refundClaims).values({
        id: c.id, bookingId: c.bookingId, agencyId: c.agencyId, cancellationId: cxl, refundPolicyId: c.refundPolicyId, refundPolicyVersion: c.refundPolicyVersion, payoutMode: c.refundPayoutMode,
        agencyRefundMinor: c.agencyRefundMinor, supplierExpectedMinor: c.supplierExpectedMinor, supplierReceivedMinor: c.supplierReceivedMinor, walletCreditedMinor: c.walletCreditedMinor,
        agencyPayoutStatus: payout, supplierStatus, status: c.status, walletLedgerEntryId: c.walletCreditedMinor > 0 ? `wle_${c.id}` : null,
        idempotencyKey: `seed:cancel:${b.id}`, createdAt: confirmedAt, updatedAt: confirmedAt, timelineJson: JSON.stringify(timeline),
      }).run();
      if (c.walletCreditedMinor > 0) {
        tx.insert(s.walletLedgerEntries).values({ id: `wle_${c.id}`, agencyId: c.agencyId, type: 'REFUND_CREDIT', direction: 'CREDIT', amountMinor: c.walletCreditedMinor, currency: 'INR', bookingId: c.bookingId, refundId: c.id, description: `Refund credit · ${c.id}`, idempotencyKey: `seed:refund:${c.id}`, createdAt: confirmedAt }).run();
      }
    }
    for (const ev of refundsFx.supplierReceiptScenarios.filter((x: any) => x.initiallyPosted)) {
      tx.insert(s.supplierSettlementEvents).values({ id: ev.id, refundId: ev.refundClaimId, supplierId: ev.supplierId, externalRef: ev.externalRef, amountMinor: ev.amountMinor, status: 'MATCHED', receivedAt: A('D-2'), note: 'Opening matched supplier receipt (seed)' }).run();
    }

    // ---- payment events (received, awaiting matching) ----
    for (const p of paymentsFx.events) {
      tx.insert(s.paymentEvents).values({ id: p.id, providerCode: paymentsFx.bankProvider, agencyId: null, agencyHint: p.agencyHint, externalPaymentRef: p.externalRef, grossAmountMinor: p.amountMinor, currency: p.currency, status: 'RECEIVED', receivedAt: A(p.receivedOffset), matchingJson: JSON.stringify(p.expectedAmountMinor ? { expectedAmountMinor: p.expectedAmountMinor } : {}) }).run();
    }

    // ---- pending application (distinct from S-A Bluebird draft) ----
    for (const app of agenciesFx.applications) {
      tx.insert(s.registrationApplications).values({ id: app.id, reference: app.reference, status: app.status, agencyDraftJson: JSON.stringify(app.draft), email: app.draft.communication.email, pan: app.draft.organization.pan, createdAt: A(app.createdOffset), updatedAt: A(app.submittedOffset), submitTime: A(app.submittedOffset), historyJson: JSON.stringify([{ at: A(app.createdOffset), status: 'DRAFT' }, { at: A(app.submittedOffset), status: 'SUBMITTED' }]) }).run();
      for (const d of app.documents) {
        const file = path.join(fixturesDir(), 'documents', d.fixtureFile);
        tx.insert(s.uploadedDocuments).values({ id: d.id, applicationId: app.id, docType: d.docType, originalName: d.originalName, storageReference: `fixture:${d.fixtureFile}`, mimetype: 'application/pdf', sizeBytes: fs.statSync(file).size, extractionStatus: 'EXTRACTED', createdAt: A(app.createdOffset) }).run();
        tx.insert(s.documentExtractions).values({ id: `ext_${d.id}`, documentId: d.id, documentType: d.docType, fieldsJson: JSON.stringify([{ name: 'agencyName', value: 'New Partner Travel', confidence: 0.97 }, { name: 'city', value: 'Pune', confidence: 0.95 }]), warningsJson: '[]', engine: 'PDF_TEXT', reviewedFieldsJson: JSON.stringify({ agencyName: 'New Partner Travel', city: 'Pune' }), createdAt: A(app.createdOffset) }).run();
      }
    }

    // ---- support cases ----
    for (const c of casesFx) {
      const created = A(c.createdOffset);
      tx.insert(s.supportCases).values({ id: c.id, agencyId: c.agencyId, userId: null, bookingId: c.bookingId, pnr: null, source: c.source, category: c.category, subcategory: null, summary: c.summary, details: null, status: c.status, assignedTo: c.assignedTo, priority: c.priority, slaDueAt: isoPlus(created, c.priority === 'HIGH' ? 4 * 3600000 : 24 * 3600000), idempotencyKey: null, createdAt: created, updatedAt: A(c.events[c.events.length - 1][1]) }).run();
      let prev: string | null = null;
      c.events.forEach(([st, off]: [string, string], i: number) => {
        tx.insert(s.caseEvents).values({ id: `${c.id}_ev${i}`, caseId: c.id, actorId: i === 0 ? null : c.assignedTo, action: i === 0 ? 'CREATED' : 'STATUS_CHANGED', fromStatus: prev, toStatus: st, note: null, createdAt: A(off) }).run();
        prev = st;
      });
    }
    const am = guided.seedAmendment;
    tx.insert(s.amendmentCases).values({ id: am.id, agencyId: am.agencyId, bookingId: am.bookingId, type: am.type, status: am.status, quoteJson: JSON.stringify({ option: 'Same flight, next day', fareDifferenceMinor: 45000, amendmentChargeMinor: 200000, profileId: 'B_RESTRICTED', slab: 'S2', guided: true }), createdBy: 'user_sky_agent', createdAt: A(am.createdOffset), updatedAt: A(am.createdOffset), timelineJson: JSON.stringify([{ at: A(am.createdOffset), status: 'REQUESTED' }, { at: A(am.createdOffset), status: 'QUOTED' }]) }).run();
  });
}

export function anchorForSeed(): string {
  if (process.env.DEMO_CLOCK_MODE === 'fixed' && process.env.DEMO_FIXED_NOW) return new Date(Date.parse(process.env.DEMO_FIXED_NOW)).toISOString();
  const d = new Date(); d.setUTCMilliseconds(0);
  return d.toISOString();
}
