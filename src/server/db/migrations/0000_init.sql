CREATE TABLE `advanced_commercial_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_name` text NOT NULL,
	`header_json` text NOT NULL,
	`criteria_json` text NOT NULL,
	`expression_lines_json` text NOT NULL,
	`priority` integer NOT NULL,
	`enabled` integer NOT NULL,
	`draft_revision` integer NOT NULL,
	`history_json` text DEFAULT '[]' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `agencies` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text NOT NULL,
	`country` text DEFAULT 'IN' NOT NULL,
	`city` text,
	`state` text,
	`pan_masked` text,
	`gstin` text,
	`contact_email` text,
	`application_id` text,
	`registered_at` text NOT NULL,
	`activated_at` text
);
--> statement-breakpoint
CREATE INDEX `agencies_status_idx` ON `agencies` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `agencies_legal_uq` ON `agencies` (`legal_name`);--> statement-breakpoint
CREATE TABLE `agency_markup_ui_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`name` text NOT NULL,
	`journey` text NOT NULL,
	`trip_types_json` text NOT NULL,
	`airline_filter` text NOT NULL,
	`cabin_filter` text NOT NULL,
	`markup_kind` text NOT NULL,
	`value` integer NOT NULL,
	`currency` text,
	`target_user_ids_json` text DEFAULT '[]' NOT NULL,
	`enabled` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `agency_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`type` text NOT NULL,
	`version` integer NOT NULL,
	`effective_from` text NOT NULL,
	`effective_until` text,
	`enabled` integer NOT NULL,
	`config_json` text NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `policy_version_uq` ON `agency_policies` (`agency_id`,`type`,`version`);--> statement-breakpoint
CREATE TABLE `amendment_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`quote_json` text NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`timeline_json` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`actor_role` text,
	`agency_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_events` (`entity_type`,`entity_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `booking_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`leg_index` integer NOT NULL,
	`direction` text NOT NULL,
	`flight_offer_id` text,
	`airline` text NOT NULL,
	`airline_name` text NOT NULL,
	`flight_number` text NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`departure_at` text NOT NULL,
	`arrival_at` text NOT NULL,
	`origin_tz` text NOT NULL,
	`destination_tz` text NOT NULL,
	`cabin` text NOT NULL,
	`fare_brand_id` text,
	`brand_name` text,
	`fare_rule_profile_id` text NOT NULL,
	`profile_version` integer NOT NULL,
	`fare_rule_snapshot_json` text NOT NULL,
	`segment_sell_minor` integer NOT NULL,
	`segment_supplier_cost_minor` integer NOT NULL,
	`price_components_json` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_seg_uq` ON `booking_segments` (`booking_id`,`leg_index`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`quote_id` text,
	`user_id` text,
	`source` text NOT NULL,
	`provider` text NOT NULL,
	`pcc` text,
	`trip_type` text NOT NULL,
	`segment_count` integer NOT NULL,
	`booking_status` text NOT NULL,
	`ticket_status` text NOT NULL,
	`payment_status` text NOT NULL,
	`funding_type` text NOT NULL,
	`booked_at` text NOT NULL,
	`first_departure_at` text NOT NULL,
	`route_summary` text NOT NULL,
	`airline_summary` text NOT NULL,
	`lead_passenger` text NOT NULL,
	`sell_amount_minor` integer NOT NULL,
	`supplier_cost_minor` integer NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`refund_policy_id` text NOT NULL,
	`refund_policy_version` integer NOT NULL,
	`refund_payout_mode` text NOT NULL,
	`failure_reason` text,
	`booking_snapshot_json` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bookings_agency_booked_idx` ON `bookings` (`agency_id`,`booked_at`);--> statement-breakpoint
CREATE INDEX `bookings_agency_status_idx` ON `bookings` (`agency_id`,`booking_status`);--> statement-breakpoint
CREATE INDEX `bookings_agency_provider_idx` ON `bookings` (`agency_id`,`provider`);--> statement-breakpoint
CREATE TABLE `cancellations` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`agency_id` text NOT NULL,
	`mode` text NOT NULL,
	`quote_snapshot_json` text NOT NULL,
	`segment_slab_breakdown_json` text NOT NULL,
	`estimated_refund_minor` integer NOT NULL,
	`status` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`requested_at` text NOT NULL,
	`requested_by` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cancellation_booking_uq` ON `cancellations` (`booking_id`);--> statement-breakpoint
CREATE TABLE `case_events` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `support_cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `core_commercial_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`agency_id` text,
	`airline_code` text,
	`origin` text,
	`destination` text,
	`fixed_fee_minor` integer NOT NULL,
	`percent_bps` integer NOT NULL,
	`disclosed_service_fee_minor` integer NOT NULL,
	`percentage_base` text DEFAULT 'SUPPLIER_BASE' NOT NULL,
	`rebate_minor` integer DEFAULT 0 NOT NULL,
	`priority` integer NOT NULL,
	`enabled` integer NOT NULL,
	`effective_from` text NOT NULL,
	`effective_until` text,
	`rule_version` integer NOT NULL,
	`history_json` text DEFAULT '[]' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `credit_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`type` text NOT NULL,
	`direction` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`booking_id` text,
	`due_at` text,
	`description` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_idem_uq` ON `credit_ledger_entries` (`agency_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `credit_agency_created_idx` ON `credit_ledger_entries` (`agency_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `demo_metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document_extractions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`document_type` text NOT NULL,
	`fields_json` text NOT NULL,
	`warnings_json` text DEFAULT '[]' NOT NULL,
	`engine` text NOT NULL,
	`reviewed_fields_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `uploaded_documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `domain_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`agency_id` text,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` text NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE TABLE `fare_brands` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`brand_code` text NOT NULL,
	`brand_name` text NOT NULL,
	`fare_class` text NOT NULL,
	`supplier_base_minor` integer NOT NULL,
	`supplier_tax_minor` integer NOT NULL,
	`refundable_label` text NOT NULL,
	`baggage_json` text NOT NULL,
	`meal` text,
	`rule_profile_id` text NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `flight_offers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rule_profile_id`) REFERENCES `fare_rule_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fare_rule_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`currency` text NOT NULL,
	`data_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `flight_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_code` text NOT NULL,
	`airline_code` text NOT NULL,
	`airline_name` text NOT NULL,
	`operating_carrier` text NOT NULL,
	`flight_number` text NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`origin_city` text NOT NULL,
	`destination_city` text NOT NULL,
	`search_origin_city` text NOT NULL,
	`search_destination_city` text NOT NULL,
	`departure_at` text NOT NULL,
	`arrival_at` text NOT NULL,
	`origin_tz` text NOT NULL,
	`destination_tz` text NOT NULL,
	`duration_min` integer NOT NULL,
	`cabin` text NOT NULL,
	`stops` integer NOT NULL,
	`via` text,
	`seats_left` integer NOT NULL,
	`aircraft` text,
	`international` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `funding_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`booking_id` text,
	`wallet_hold_minor` integer NOT NULL,
	`credit_hold_minor` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reservations_agency_status_idx` ON `funding_reservations` (`agency_id`,`status`);--> statement-breakpoint
CREATE TABLE `fx_demo_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`base_currency` text NOT NULL,
	`quote_currency` text NOT NULL,
	`inr_per_unit` text NOT NULL,
	`effective_date` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`operation` text NOT NULL,
	`key` text NOT NULL,
	`actor_id` text,
	`agency_id` text,
	`fingerprint` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idem_op_key_uq` ON `idempotency_keys` (`operation`,`key`);--> statement-breakpoint
CREATE TABLE `kyc_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`document_id` text,
	`check_type` text NOT NULL,
	`mock_result` text NOT NULL,
	`reason` text,
	`source` text DEFAULT 'SIMULATED' NOT NULL,
	`checked_at` text NOT NULL,
	`actor_id` text,
	FOREIGN KEY (`application_id`) REFERENCES `registration_applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `modeled_costs` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`agency_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `modeled_cost_uq` ON `modeled_costs` (`booking_id`,`kind`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text,
	`user_id` text,
	`audience` text NOT NULL,
	`kind` text NOT NULL,
	`reference_id` text,
	`title` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`seen_at` text
);
--> statement-breakpoint
CREATE TABLE `passengers` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`display_name` text NOT NULL,
	`traveler_type` text NOT NULL,
	`masked_doc_reference` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_code` text NOT NULL,
	`agency_id` text,
	`agency_hint` text,
	`external_payment_ref` text NOT NULL,
	`gross_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`received_at` text NOT NULL,
	`matching_json` text DEFAULT '{}' NOT NULL,
	`replay_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_ref_uq` ON `payment_events` (`provider_code`,`external_payment_ref`);--> statement-breakpoint
CREATE TABLE `payment_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_event_id` text NOT NULL,
	`agency_id` text NOT NULL,
	`status` text NOT NULL,
	`matched_at` text NOT NULL,
	`matched_by` text NOT NULL,
	`ledger_entry_id` text,
	FOREIGN KEY (`payment_event_id`) REFERENCES `payment_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_match_uq` ON `payment_matches` (`payment_event_id`);--> statement-breakpoint
CREATE TABLE `pcc_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`pcc_code` text NOT NULL,
	`agency_id` text,
	`enabled` integer NOT NULL,
	`description` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pnr_records` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`provider` text NOT NULL,
	`pcc` text NOT NULL,
	`gds_pnr` text NOT NULL,
	`airline_pnr` text,
	`imported` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pnr_provider_pcc_uq` ON `pnr_records` (`provider`,`pcc`,`gds_pnr`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_code` text NOT NULL,
	`provider_kind` text NOT NULL,
	`status` text NOT NULL,
	`mode` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quote_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`leg_index` integer NOT NULL,
	`direction` text NOT NULL,
	`offer_id` text NOT NULL,
	`brand_id` text NOT NULL,
	`fare_rule_profile_id` text NOT NULL,
	`profile_version` integer NOT NULL,
	`core_rule_id` text NOT NULL,
	`core_rule_version` integer NOT NULL,
	`supplier_base_minor` integer NOT NULL,
	`supplier_tax_minor` integer NOT NULL,
	`fixed_fee_minor` integer NOT NULL,
	`percent_fee_minor` integer NOT NULL,
	`disclosed_service_fee_minor` integer NOT NULL,
	`rebate_minor` integer NOT NULL,
	`price_adjustment_minor` integer DEFAULT 0 NOT NULL,
	`leg_sell_minor` integer NOT NULL,
	`leg_supplier_cost_minor` integer NOT NULL,
	`departure_at` text NOT NULL,
	`arrival_at` text NOT NULL,
	`snapshot_json` text NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_seg_uq` ON `quote_segments` (`quote_id`,`leg_index`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`user_id` text NOT NULL,
	`trip_type` text NOT NULL,
	`segment_count` integer NOT NULL,
	`supplier_cost_minor` integer NOT NULL,
	`sell_amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`passengers_json` text NOT NULL,
	`status` text NOT NULL,
	`previous_quote_id` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`snapshot_json` text NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quotes_agency_idx` ON `quotes` (`agency_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `refund_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`agency_id` text NOT NULL,
	`cancellation_id` text,
	`refund_policy_id` text NOT NULL,
	`refund_policy_version` integer NOT NULL,
	`payout_mode` text NOT NULL,
	`agency_refund_minor` integer NOT NULL,
	`supplier_expected_minor` integer NOT NULL,
	`supplier_received_minor` integer NOT NULL,
	`wallet_credited_minor` integer NOT NULL,
	`agency_payout_status` text NOT NULL,
	`supplier_status` text NOT NULL,
	`status` text NOT NULL,
	`wallet_ledger_entry_id` text,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`timeline_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refund_booking_uq` ON `refund_claims` (`booking_id`);--> statement-breakpoint
CREATE INDEX `refund_agency_idx` ON `refund_claims` (`agency_id`,`agency_payout_status`,`created_at`);--> statement-breakpoint
CREATE TABLE `registration_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`status` text NOT NULL,
	`agency_draft_json` text NOT NULL,
	`email` text,
	`pan` text,
	`access_token_hash` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`submit_time` text,
	`reviewer_id` text,
	`decision_time` text,
	`decision_note` text,
	`agency_id` text,
	`history_json` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `applications_status_idx` ON `registration_applications` (`status`,`submit_time`);--> statement-breakpoint
CREATE UNIQUE INDEX `applications_ref_uq` ON `registration_applications` (`reference`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_hash_uq` ON `sessions` (`session_hash`);--> statement-breakpoint
CREATE TABLE `supplier_settlement_events` (
	`id` text PRIMARY KEY NOT NULL,
	`refund_id` text NOT NULL,
	`supplier_id` text NOT NULL,
	`external_ref` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`status` text NOT NULL,
	`received_at` text NOT NULL,
	`note` text,
	FOREIGN KEY (`refund_id`) REFERENCES `refund_claims`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_event_uq` ON `supplier_settlement_events` (`supplier_id`,`external_ref`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`demo_code` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `support_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`user_id` text,
	`booking_id` text,
	`pnr` text,
	`source` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`summary` text NOT NULL,
	`details` text,
	`status` text NOT NULL,
	`assigned_to` text,
	`priority` text NOT NULL,
	`sla_due_at` text,
	`idempotency_key` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cases_agency_idx` ON `support_cases` (`agency_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `support_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`user_id` text NOT NULL,
	`locale` text NOT NULL,
	`menu_state` text NOT NULL,
	`selected_booking_id` text,
	`draft_payload_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`passenger_id` text,
	`ticket_number` text NOT NULL,
	`issued_at` text NOT NULL,
	`status` text NOT NULL,
	`imported` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ticket_number_uq` ON `tickets` (`ticket_number`);--> statement-breakpoint
CREATE TABLE `uploaded_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`doc_type` text NOT NULL,
	`original_name` text NOT NULL,
	`storage_reference` text NOT NULL,
	`mimetype` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`extraction_status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `registration_applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`permission_key` text NOT NULL,
	`allowed` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_perm_uq` ON `user_permissions` (`user_id`,`permission_key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`mobile` text,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_agency_role_idx` ON `users` (`agency_id`,`role`,`status`);--> statement-breakpoint
CREATE TABLE `wallet_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`agency_id` text NOT NULL,
	`type` text NOT NULL,
	`direction` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`external_ref` text,
	`booking_id` text,
	`refund_id` text,
	`description` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_idem_uq` ON `wallet_ledger_entries` (`agency_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `wallet_agency_created_idx` ON `wallet_ledger_entries` (`agency_id`,`created_at`);