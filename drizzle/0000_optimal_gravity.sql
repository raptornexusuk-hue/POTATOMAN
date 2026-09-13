CREATE TABLE `members` (
	`room` text NOT NULL,
	`slot` integer NOT NULL,
	`token` text NOT NULL,
	`name` text NOT NULL,
	`seen` integer NOT NULL,
	`input` text,
	`input_seq` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`room`, `slot`),
	FOREIGN KEY (`room`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`snapshot` text,
	`seq` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rooms_updated` ON `rooms` (`updated`);--> statement-breakpoint
CREATE TABLE `signals` (
	`room` text NOT NULL,
	`sender` integer NOT NULL,
	`recipient` integer NOT NULL,
	`description` text NOT NULL,
	PRIMARY KEY(`room`, `sender`, `recipient`),
	FOREIGN KEY (`room`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
