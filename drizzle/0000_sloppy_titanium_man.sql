CREATE TABLE `actors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`details` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `costing_cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `actors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_case_created` ON `audit_events` (`case_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `benchmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`capability_id` text,
	`provider` text NOT NULL,
	`rate` text NOT NULL,
	`unit` text NOT NULL,
	`source` text NOT NULL,
	`notes` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `costing_cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`capability_id`) REFERENCES `capabilities`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_benchmarks_case` ON `benchmarks` (`case_id`);--> statement-breakpoint
CREATE TABLE `calculation_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`formula_version` text NOT NULL,
	`input_json` text NOT NULL,
	`output_json` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `costing_cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `actors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_snapshots_case_created` ON `calculation_snapshots` (`case_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `capabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`name` text NOT NULL,
	`billable_unit` text NOT NULL,
	`active` integer NOT NULL,
	`display_order` integer NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `costing_cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_capabilities_case_order` ON `capabilities` (`case_id`,`display_order`);--> statement-breakpoint
CREATE TABLE `capacity_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`capability_id` text NOT NULL,
	`maximum_capacity` text NOT NULL,
	`forecast_utilisation_pct` text NOT NULL,
	`historic_year_1` text,
	`historic_year_2` text,
	`historic_year_3` text,
	`justification` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `costing_cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`capability_id`) REFERENCES `capabilities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_capacity_plans_capability` ON `capacity_plans` (`capability_id`);--> statement-breakpoint
CREATE TABLE `cost_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`capability_id` text,
	`category` text NOT NULL,
	`scope` text NOT NULL,
	`label` text NOT NULL,
	`amount` text NOT NULL,
	`justification` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `costing_cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`capability_id`) REFERENCES `capabilities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cost_lines_case_scope` ON `cost_lines` (`case_id`,`scope`);--> statement-breakpoint
CREATE TABLE `costing_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`platform_name` text NOT NULL,
	`pricing_period` text NOT NULL,
	`status` text NOT NULL,
	`formula_version` text NOT NULL,
	`owner_id` text NOT NULL,
	`current_step` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `actors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_costing_cases_status_updated` ON `costing_cases` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `income_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`source_name` text NOT NULL,
	`source_type` text NOT NULL,
	`amount` text NOT NULL,
	`justification` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `costing_cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_income_lines_case_type` ON `income_lines` (`case_id`,`source_type`);--> statement-breakpoint
CREATE TABLE `proposed_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`capability_id` text NOT NULL,
	`uwa_rate` text,
	`apfr_rate` text,
	`commercial_rate` text,
	`uwa_share_pct` text NOT NULL,
	`apfr_share_pct` text NOT NULL,
	`commercial_share_pct` text NOT NULL,
	`justification` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `costing_cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`capability_id`) REFERENCES `capabilities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_proposed_rates_capability` ON `proposed_rates` (`capability_id`);