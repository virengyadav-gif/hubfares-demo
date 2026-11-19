CREATE TABLE `approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`agency_id` text,
	`summary` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text NOT NULL,
	`requested_by` text NOT NULL,
	`requested_by_name` text,
	`requested_at` text NOT NULL,
	`decided_by` text,
	`decided_by_name` text,
	`decided_at` text,
	`decision_note` text,
	`result_json` text
);
--> statement-breakpoint
CREATE INDEX `approval_status_idx` ON `approval_requests` (`status`,`requested_at`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `parent_booking_id` text;