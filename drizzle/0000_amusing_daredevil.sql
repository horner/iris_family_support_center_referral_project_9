CREATE TABLE `case_decisions` (
	`message_id` text PRIMARY KEY NOT NULL,
	`outcome` text NOT NULL,
	`proposed_staff_id` text,
	`runners_up` text,
	`rationale` text,
	`contended_with` text,
	`unknowns` text,
	`requires_supervisor_judgment` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `cases`(`message_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cases` (
	`message_id` text PRIMARY KEY NOT NULL,
	`referral_id` text,
	`case_number` text,
	`service` text,
	`county` text,
	`region` text,
	`fcm_name` text,
	`fcm_phone` text,
	`requested_start_date` text,
	`children_in_home` integer,
	`notes` text,
	`subject` text,
	`received_at` text,
	`preferences` text,
	`parse_warnings` text,
	`status` text NOT NULL,
	`proposed_staff_id` text,
	`committed_staff_id` text,
	`committed_by` text,
	`committed_at` text,
	`decline_reason` text,
	`commit_key` text,
	FOREIGN KEY (`proposed_staff_id`) REFERENCES `staff`(`staff_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`committed_staff_id`) REFERENCES `staff`(`staff_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `services` (
	`service` text PRIMARY KEY NOT NULL,
	`minimum_education` text NOT NULL,
	`eligible_roles` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`staff_id` text PRIMARY KEY NOT NULL,
	`staff_name` text NOT NULL,
	`education` text NOT NULL,
	`role` text NOT NULL,
	`counties_served` text NOT NULL,
	`max_families_dcs` integer NOT NULL,
	`current_families_assigned` integer NOT NULL,
	`languages` text NOT NULL,
	`availability` text NOT NULL,
	`active` integer NOT NULL
);
