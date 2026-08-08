CREATE TABLE `commitments` (
	`commit_key` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`status` text NOT NULL,
	`staff_id` text,
	`decline_reason` text,
	`committed_by` text NOT NULL,
	`committed_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`staff_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `commitments_message_id_unique` ON `commitments` (`message_id`);