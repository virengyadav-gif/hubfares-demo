/**
 * Canonical relational schema — implements Technical Design §3.2 / §3.3.
 * Money columns are integer paise (`*_minor`). Timestamps are ISO-8601 UTC strings.
 * Ledger, audit and domain-event tables are append-only by service contract.
 */
import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const agencies = sqliteTable('agencies', {
  id: text('id').primaryKey(),
  legalName: text('legal_name').notNull(),
  displayName: text('display_name').notNull(),
  status: text('status').notNull(), // ACTIVE | SUSPENDED | INACTIVE
  country: text('country').notNull().default('IN'),
  city: text('city'),
  state: text('state'),
  panMasked: text('pan_masked'),
  gstin: text('gstin'),
  contactEmail: text('contact_email'),
  applicationId: text('application_id'),
  registeredAt: text('registered_at').notNull(),
  activatedAt: text('activated_at'),
}, (t) => [index('agencies_status_idx').on(t.status), uniqueIndex('agencies_legal_uq').on(t.legalName)]);

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  agencyId: text('agency_id').references(() => agencies.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  mobile: text('mobile'),
  role: text('role').notNull(),
  status: text('status').notNull(), // ACTIVE | INACTIVE
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [uniqueIndex('users_email_uq').on(t.email), index('users_agency_role_idx').on(t.agencyId, t.role, t.status)]);

export const userPermissions = sqliteTable('user_permissions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  permissionKey: text('permission_key').notNull(),
  allowed: integer('allowed', { mode: 'boolean' }).notNull(),
}, (t) => [uniqueIndex('user_perm_uq').on(t.userId, t.permissionKey)]);

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  sessionHash: text('session_hash').notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at'),
}, (t) => [uniqueIndex('sessions_hash_uq').on(t.sessionHash)]);

export const registrationApplications = sqliteTable('registration_applications', {
  id: text('id').primaryKey(),
  reference: text('reference').notNull(),
  status: text('status').notNull(), // DRAFT | SUBMITTED | UNDER_REVIEW | MORE_INFO_REQUIRED | APPROVED | REJECTED
  agencyDraftJson: text('agency_draft_json').notNull(),
  email: text('email'),
  pan: text('pan'),
  accessTokenHash: text('access_token_hash'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  submitTime: text('submit_time'),
  reviewerId: text('reviewer_id'),
  decisionTime: text('decision_time'),
  decisionNote: text('decision_note'),
  agencyId: text('agency_id'),
  historyJson: text('history_json').notNull().default('[]'),
}, (t) => [index('applications_status_idx').on(t.status, t.submitTime), uniqueIndex('applications_ref_uq').on(t.reference)]);

export const uploadedDocuments = sqliteTable('uploaded_documents', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull().references(() => registrationApplications.id),
  docType: text('doc_type').notNull(),
  originalName: text('original_name').notNull(),
  storageReference: text('storage_reference').notNull(),
  mimetype: text('mimetype').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  extractionStatus: text('extraction_status').notNull(), // UPLOADED | PROCESSING | EXTRACTED | FAILED | NEEDS_MANUAL_REVIEW
  createdAt: text('created_at').notNull(),
});

export const documentExtractions = sqliteTable('document_extractions', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => uploadedDocuments.id),
  documentType: text('document_type').notNull(),
  fieldsJson: text('fields_json').notNull(),
  warningsJson: text('warnings_json').notNull().default('[]'),
  engine: text('engine').notNull(),
  reviewedFieldsJson: text('reviewed_fields_json'),
  createdAt: text('created_at').notNull(),
});

export const kycChecks = sqliteTable('kyc_checks', {
  id: text('id').primaryKey(),
  applicationId: text('application_id').notNull().references(() => registrationApplications.id),
  documentId: text('document_id'),
  checkType: text('check_type').notNull(), // PAN | IDENTITY | BUSINESS
  mockResult: text('mock_result').notNull(), // VERIFIED | FAILED | PENDING
  reason: text('reason'),
  source: text('source').notNull().default('SIMULATED'),
  checkedAt: text('checked_at').notNull(),
  actorId: text('actor_id'),
});

export const agencyPolicies = sqliteTable('agency_policies', {
  id: text('id').primaryKey(),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  type: text('type').notNull(), // CREDIT | REFUND
  version: integer('version').notNull(),
  effectiveFrom: text('effective_from').notNull(),
  effectiveUntil: text('effective_until'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull(),
  configJson: text('config_json').notNull(),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
}, (t) => [uniqueIndex('policy_version_uq').on(t.agencyId, t.type, t.version)]);

export const agencyMarkupUiRules = sqliteTable('agency_markup_ui_rules', {
  id: text('id').primaryKey(),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  name: text('name').notNull(),
  journey: text('journey').notNull(),
  tripTypesJson: text('trip_types_json').notNull(),
  airlineFilter: text('airline_filter').notNull(),
  cabinFilter: text('cabin_filter').notNull(),
  markupKind: text('markup_kind').notNull(), // FIXED | PERCENT
  value: integer('value').notNull(), // FIXED: paise; PERCENT: basis points
  currency: text('currency'),
  targetUserIdsJson: text('target_user_ids_json').notNull().default('[]'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const coreCommercialRules = sqliteTable('core_commercial_rules', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  agencyId: text('agency_id'),
  airlineCode: text('airline_code'),
  origin: text('origin'),
  destination: text('destination'),
  fixedFeeMinor: integer('fixed_fee_minor').notNull(),
  percentBps: integer('percent_bps').notNull(),
  disclosedServiceFeeMinor: integer('disclosed_service_fee_minor').notNull(),
  percentageBase: text('percentage_base').notNull().default('SUPPLIER_BASE'),
  rebateMinor: integer('rebate_minor').notNull().default(0),
  priority: integer('priority').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull(),
  effectiveFrom: text('effective_from').notNull(),
  effectiveUntil: text('effective_until'),
  ruleVersion: integer('rule_version').notNull(),
  historyJson: text('history_json').notNull().default('[]'),
  updatedAt: text('updated_at').notNull(),
});

export const advancedCommercialDrafts = sqliteTable('advanced_commercial_drafts', {
  id: text('id').primaryKey(),
  ruleName: text('rule_name').notNull(),
  headerJson: text('header_json').notNull(),
  criteriaJson: text('criteria_json').notNull(),
  expressionLinesJson: text('expression_lines_json').notNull(),
  priority: integer('priority').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull(),
  draftRevision: integer('draft_revision').notNull(),
  historyJson: text('history_json').notNull().default('[]'),
  updatedAt: text('updated_at').notNull(),
});

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  providerCode: text('provider_code').notNull(),
  providerKind: text('provider_kind').notNull(),
  status: text('status').notNull(),
  mode: text('mode').notNull(),
});

export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  demoCode: text('demo_code').notNull(),
  status: text('status').notNull(),
});

export const pccMappings = sqliteTable('pcc_mappings', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull().references(() => providers.id),
  pccCode: text('pcc_code').notNull(),
  agencyId: text('agency_id'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull(),
  description: text('description').notNull(),
});

export const flightOffers = sqliteTable('flight_offers', {
  id: text('id').primaryKey(),
  providerCode: text('provider_code').notNull(),
  airlineCode: text('airline_code').notNull(),
  airlineName: text('airline_name').notNull(),
  operatingCarrier: text('operating_carrier').notNull(),
  flightNumber: text('flight_number').notNull(),
  origin: text('origin').notNull(),
  destination: text('destination').notNull(),
  originCity: text('origin_city').notNull(),
  destinationCity: text('destination_city').notNull(),
  searchOriginCity: text('search_origin_city').notNull(),
  searchDestinationCity: text('search_destination_city').notNull(),
  departureAt: text('departure_at').notNull(),
  arrivalAt: text('arrival_at').notNull(),
  originTz: text('origin_tz').notNull(),
  destinationTz: text('destination_tz').notNull(),
  durationMin: integer('duration_min').notNull(),
  cabin: text('cabin').notNull(),
  stops: integer('stops').notNull(),
  via: text('via'),
  seatsLeft: integer('seats_left').notNull(),
  aircraft: text('aircraft'),
  international: integer('international', { mode: 'boolean' }).notNull(),
});

export const fareBrands = sqliteTable('fare_brands', {
  id: text('id').primaryKey(),
  offerId: text('offer_id').notNull().references(() => flightOffers.id),
  brandCode: text('brand_code').notNull(),
  brandName: text('brand_name').notNull(),
  fareClass: text('fare_class').notNull(),
  supplierBaseMinor: integer('supplier_base_minor').notNull(),
  supplierTaxMinor: integer('supplier_tax_minor').notNull(),
  refundableLabel: text('refundable_label').notNull(),
  baggageJson: text('baggage_json').notNull(),
  meal: text('meal'),
  ruleProfileId: text('rule_profile_id').notNull().references(() => fareRuleProfiles.id),
});

export const fareRuleProfiles = sqliteTable('fare_rule_profiles', {
  id: text('id').primaryKey(),
  version: integer('version').notNull(),
  currency: text('currency').notNull(),
  dataJson: text('data_json').notNull(),
});

export const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey(),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  userId: text('user_id').notNull(),
  tripType: text('trip_type').notNull(),
  segmentCount: integer('segment_count').notNull(),
  supplierCostMinor: integer('supplier_cost_minor').notNull(),
  sellAmountMinor: integer('sell_amount_minor').notNull(),
  currency: text('currency').notNull(),
  passengersJson: text('passengers_json').notNull(),
  status: text('status').notNull(), // OPEN | REVALIDATED | PRICE_CHANGED | UNAVAILABLE | SUPERSEDED | BOOKED | DECLINED
  previousQuoteId: text('previous_quote_id'),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
}, (t) => [index('quotes_agency_idx').on(t.agencyId, t.createdAt)]);

export const quoteSegments = sqliteTable('quote_segments', {
  id: text('id').primaryKey(),
  quoteId: text('quote_id').notNull().references(() => quotes.id),
  legIndex: integer('leg_index').notNull(),
  direction: text('direction').notNull(),
  offerId: text('offer_id').notNull(),
  brandId: text('brand_id').notNull(),
  fareRuleProfileId: text('fare_rule_profile_id').notNull(),
  profileVersion: integer('profile_version').notNull(),
  coreRuleId: text('core_rule_id').notNull(),
  coreRuleVersion: integer('core_rule_version').notNull(),
  supplierBaseMinor: integer('supplier_base_minor').notNull(),
  supplierTaxMinor: integer('supplier_tax_minor').notNull(),
  fixedFeeMinor: integer('fixed_fee_minor').notNull(),
  percentFeeMinor: integer('percent_fee_minor').notNull(),
  disclosedServiceFeeMinor: integer('disclosed_service_fee_minor').notNull(),
  rebateMinor: integer('rebate_minor').notNull(),
  priceAdjustmentMinor: integer('price_adjustment_minor').notNull().default(0),
  legSellMinor: integer('leg_sell_minor').notNull(),
  legSupplierCostMinor: integer('leg_supplier_cost_minor').notNull(),
  departureAt: text('departure_at').notNull(),
  arrivalAt: text('arrival_at').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
}, (t) => [uniqueIndex('quote_seg_uq').on(t.quoteId, t.legIndex)]);

export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  quoteId: text('quote_id'),
  userId: text('user_id'),
  source: text('source').notNull(), // PORTAL | IMPORTED | MANUAL_DEMO
  provider: text('provider').notNull(),
  pcc: text('pcc'),
  tripType: text('trip_type').notNull(),
  segmentCount: integer('segment_count').notNull(),
  bookingStatus: text('booking_status').notNull(), // PNR_CREATED | TICKETED | BOOKING_FAILED | TICKETING_FAILED | CANCELLED | VOIDED | MANUAL_RECORDED
  ticketStatus: text('ticket_status').notNull(), // NOT_ISSUED | PENDING | ISSUED | FAILED | CANCELLED | VOIDED
  paymentStatus: text('payment_status').notNull(), // NONE | HELD | CHARGED | RELEASED | REFUND_PENDING | REFUNDED
  fundingType: text('funding_type').notNull(), // WALLET | CREDIT | MIXED | NONE
  bookedAt: text('booked_at').notNull(),
  firstDepartureAt: text('first_departure_at').notNull(),
  routeSummary: text('route_summary').notNull(),
  airlineSummary: text('airline_summary').notNull(),
  leadPassenger: text('lead_passenger').notNull(),
  sellAmountMinor: integer('sell_amount_minor').notNull(),
  supplierCostMinor: integer('supplier_cost_minor').notNull(),
  currency: text('currency').notNull().default('INR'),
  refundPolicyId: text('refund_policy_id').notNull(),
  refundPolicyVersion: integer('refund_policy_version').notNull(),
  refundPayoutMode: text('refund_payout_mode').notNull(),
  failureReason: text('failure_reason'),
  bookingSnapshotJson: text('booking_snapshot_json').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [
  index('bookings_agency_booked_idx').on(t.agencyId, t.bookedAt),
  index('bookings_agency_status_idx').on(t.agencyId, t.bookingStatus),
  index('bookings_agency_provider_idx').on(t.agencyId, t.provider),
]);

export const bookingSegments = sqliteTable('booking_segments', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  legIndex: integer('leg_index').notNull(),
  direction: text('direction').notNull(),
  flightOfferId: text('flight_offer_id'),
  airline: text('airline').notNull(),
  airlineName: text('airline_name').notNull(),
  flightNumber: text('flight_number').notNull(),
  origin: text('origin').notNull(),
  destination: text('destination').notNull(),
  departureAt: text('departure_at').notNull(),
  arrivalAt: text('arrival_at').notNull(),
  originTz: text('origin_tz').notNull(),
  destinationTz: text('destination_tz').notNull(),
  cabin: text('cabin').notNull(),
  fareBrandId: text('fare_brand_id'),
  brandName: text('brand_name'),
  fareRuleProfileId: text('fare_rule_profile_id').notNull(),
  profileVersion: integer('profile_version').notNull(),
  fareRuleSnapshotJson: text('fare_rule_snapshot_json').notNull(),
  segmentSellMinor: integer('segment_sell_minor').notNull(),
  segmentSupplierCostMinor: integer('segment_supplier_cost_minor').notNull(),
  priceComponentsJson: text('price_components_json').notNull(),
}, (t) => [uniqueIndex('booking_seg_uq').on(t.bookingId, t.legIndex)]);

export const passengers = sqliteTable('passengers', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  displayName: text('display_name').notNull(),
  travelerType: text('traveler_type').notNull(),
  maskedDocReference: text('masked_doc_reference'),
});

export const pnrRecords = sqliteTable('pnr_records', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  provider: text('provider').notNull(),
  pcc: text('pcc').notNull(),
  gdsPnr: text('gds_pnr').notNull(),
  airlinePnr: text('airline_pnr'),
  imported: integer('imported', { mode: 'boolean' }).notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [uniqueIndex('pnr_provider_pcc_uq').on(t.provider, t.pcc, t.gdsPnr)]);

export const tickets = sqliteTable('tickets', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  passengerId: text('passenger_id'),
  ticketNumber: text('ticket_number').notNull(),
  issuedAt: text('issued_at').notNull(),
  status: text('status').notNull(), // ISSUED | CANCELLED | VOIDED
  imported: integer('imported', { mode: 'boolean' }).notNull().default(false),
}, (t) => [uniqueIndex('ticket_number_uq').on(t.ticketNumber)]);

export const fundingReservations = sqliteTable('funding_reservations', {
  id: text('id').primaryKey(),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  bookingId: text('booking_id'),
  walletHoldMinor: integer('wallet_hold_minor').notNull(),
  creditHoldMinor: integer('credit_hold_minor').notNull(),
  status: text('status').notNull(), // ACTIVE | CONSUMED | RELEASED
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [index('reservations_agency_status_idx').on(t.agencyId, t.status)]);

export const walletLedgerEntries = sqliteTable('wallet_ledger_entries', {
  id: text('id').primaryKey(),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  type: text('type').notNull(), // OPENING | PAYMENT_CREDIT | BOOKING_DEBIT | REFUND_CREDIT | ADJUSTMENT | REVERSAL
  direction: text('direction').notNull(), // CREDIT | DEBIT
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull(),
  externalRef: text('external_ref'),
  bookingId: text('booking_id'),
  refundId: text('refund_id'),
  description: text('description').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [uniqueIndex('wallet_idem_uq').on(t.agencyId, t.idempotencyKey), index('wallet_agency_created_idx').on(t.agencyId, t.createdAt)]);

export const creditLedgerEntries = sqliteTable('credit_ledger_entries', {
  id: text('id').primaryKey(),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  type: text('type').notNull(), // DRAW | REPAYMENT | ADJUSTMENT
  direction: text('direction').notNull(), // DRAW | REPAY
  amountMinor: integer('amount_minor').notNull(),
  bookingId: text('booking_id'),
  dueAt: text('due_at'),
  description: text('description').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [uniqueIndex('credit_idem_uq').on(t.agencyId, t.idempotencyKey), index('credit_agency_created_idx').on(t.agencyId, t.createdAt)]);

export const paymentEvents = sqliteTable('payment_events', {
  id: text('id').primaryKey(),
  providerCode: text('provider_code').notNull(),
  agencyId: text('agency_id'),
  agencyHint: text('agency_hint'),
  externalPaymentRef: text('external_payment_ref').notNull(),
  grossAmountMinor: integer('gross_amount_minor').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull(), // RECEIVED | MATCHED | CREDITED | UNMATCHED | EXCEPTION | REJECTED
  receivedAt: text('received_at').notNull(),
  matchingJson: text('matching_json').notNull().default('{}'),
  replayCount: integer('replay_count').notNull().default(0),
}, (t) => [uniqueIndex('payment_ref_uq').on(t.providerCode, t.externalPaymentRef)]);

export const paymentMatches = sqliteTable('payment_matches', {
  id: text('id').primaryKey(),
  paymentEventId: text('payment_event_id').notNull().references(() => paymentEvents.id),
  agencyId: text('agency_id').notNull(),
  status: text('status').notNull(),
  matchedAt: text('matched_at').notNull(),
  matchedBy: text('matched_by').notNull(),
  ledgerEntryId: text('ledger_entry_id'),
}, (t) => [uniqueIndex('payment_match_uq').on(t.paymentEventId)]);

export const cancellations = sqliteTable('cancellations', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  agencyId: text('agency_id').notNull(),
  mode: text('mode').notNull(), // CANCEL | VOID
  quoteSnapshotJson: text('quote_snapshot_json').notNull(),
  segmentSlabBreakdownJson: text('segment_slab_breakdown_json').notNull(),
  estimatedRefundMinor: integer('estimated_refund_minor').notNull(),
  status: text('status').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  requestedAt: text('requested_at').notNull(),
  requestedBy: text('requested_by'),
}, (t) => [uniqueIndex('cancellation_booking_uq').on(t.bookingId)]);

export const refundClaims = sqliteTable('refund_claims', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  agencyId: text('agency_id').notNull(),
  cancellationId: text('cancellation_id'),
  refundPolicyId: text('refund_policy_id').notNull(),
  refundPolicyVersion: integer('refund_policy_version').notNull(),
  payoutMode: text('payout_mode').notNull(),
  agencyRefundMinor: integer('agency_refund_minor').notNull(),
  supplierExpectedMinor: integer('supplier_expected_minor').notNull(),
  supplierReceivedMinor: integer('supplier_received_minor').notNull(),
  walletCreditedMinor: integer('wallet_credited_minor').notNull(),
  agencyPayoutStatus: text('agency_payout_status').notNull(), // PENDING | CREDITED | NOT_APPLICABLE | APPROVAL_PENDING
  supplierStatus: text('supplier_status').notNull(), // PENDING | RECEIVED | EXCEPTION | NOT_APPLICABLE
  status: text('status').notNull(),
  walletLedgerEntryId: text('wallet_ledger_entry_id'),
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  timelineJson: text('timeline_json').notNull().default('[]'),
}, (t) => [uniqueIndex('refund_booking_uq').on(t.bookingId), index('refund_agency_idx').on(t.agencyId, t.agencyPayoutStatus, t.createdAt)]);

export const supplierSettlementEvents = sqliteTable('supplier_settlement_events', {
  id: text('id').primaryKey(),
  refundId: text('refund_id').notNull().references(() => refundClaims.id),
  supplierId: text('supplier_id').notNull(),
  externalRef: text('external_ref').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  status: text('status').notNull(), // MATCHED | EXCEPTION
  receivedAt: text('received_at').notNull(),
  note: text('note'),
}, (t) => [uniqueIndex('supplier_event_uq').on(t.supplierId, t.externalRef)]);

export const supportConversations = sqliteTable('support_conversations', {
  id: text('id').primaryKey(),
  agencyId: text('agency_id').notNull(),
  userId: text('user_id').notNull(),
  locale: text('locale').notNull(),
  menuState: text('menu_state').notNull(),
  selectedBookingId: text('selected_booking_id'),
  draftPayloadJson: text('draft_payload_json').notNull().default('{}'),
  updatedAt: text('updated_at').notNull(),
});

export const supportCases = sqliteTable('support_cases', {
  id: text('id').primaryKey(),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  userId: text('user_id'),
  bookingId: text('booking_id'),
  pnr: text('pnr'),
  source: text('source').notNull(), // CHATBOT | OPERATIONS | SYSTEM
  category: text('category').notNull(),
  subcategory: text('subcategory'),
  summary: text('summary').notNull(),
  details: text('details'),
  status: text('status').notNull(),
  assignedTo: text('assigned_to'),
  priority: text('priority').notNull(),
  slaDueAt: text('sla_due_at'),
  idempotencyKey: text('idempotency_key'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [index('cases_agency_idx').on(t.agencyId, t.status, t.createdAt)]);

export const caseEvents = sqliteTable('case_events', {
  id: text('id').primaryKey(),
  caseId: text('case_id').notNull().references(() => supportCases.id),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  note: text('note'),
  createdAt: text('created_at').notNull(),
});

export const amendmentCases = sqliteTable('amendment_cases', {
  id: text('id').primaryKey(),
  agencyId: text('agency_id').notNull(),
  bookingId: text('booking_id').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  quoteJson: text('quote_json').notNull(),
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  timelineJson: text('timeline_json').notNull().default('[]'),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  agencyId: text('agency_id'),
  userId: text('user_id'),
  audience: text('audience').notNull(), // AGENCY | HUB
  kind: text('kind').notNull(),
  referenceId: text('reference_id'),
  title: text('title').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  createdAt: text('created_at').notNull(),
  seenAt: text('seen_at'),
});

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  actorId: text('actor_id'),
  actorRole: text('actor_role'),
  agencyId: text('agency_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  metadataJson: text('metadata_json').notNull().default('{}'),
  occurredAt: text('occurred_at').notNull(),
}, (t) => [index('audit_entity_idx').on(t.entityType, t.entityId, t.occurredAt)]);

export const domainEvents = sqliteTable('domain_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  agencyId: text('agency_id'),
  payloadJson: text('payload_json').notNull().default('{}'),
  occurredAt: text('occurred_at').notNull(),
  processedAt: text('processed_at'),
});

export const fxDemoRates = sqliteTable('fx_demo_rates', {
  id: text('id').primaryKey(),
  baseCurrency: text('base_currency').notNull(),
  quoteCurrency: text('quote_currency').notNull(),
  inrPerUnit: text('inr_per_unit').notNull(),
  effectiveDate: text('effective_date').notNull(),
  source: text('source').notNull(),
});

export const modeledCosts = sqliteTable('modeled_costs', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  agencyId: text('agency_id').notNull(),
  kind: text('kind').notNull(), // VARIABLE_PROCESSING
  amountMinor: integer('amount_minor').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [uniqueIndex('modeled_cost_uq').on(t.bookingId, t.kind)]);

export const idempotencyKeys = sqliteTable('idempotency_keys', {
  id: text('id').primaryKey(),
  operation: text('operation').notNull(),
  key: text('key').notNull(),
  actorId: text('actor_id'),
  agencyId: text('agency_id'),
  fingerprint: text('fingerprint').notNull(),
  resultJson: text('result_json').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [uniqueIndex('idem_op_key_uq').on(t.operation, t.key)]);

export const demoMetadata = sqliteTable('demo_metadata', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
