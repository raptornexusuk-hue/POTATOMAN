CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`name` text NOT NULL,
	`motto` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_profiles_token` ON `profiles` (`token`);--> statement-breakpoint
CREATE TABLE `race_times` (
	`run` text NOT NULL,
	`level` integer NOT NULL,
	`milliseconds` integer NOT NULL,
	PRIMARY KEY(`run`, `level`),
	FOREIGN KEY (`run`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_race_times_level_time` ON `race_times` (`level`,`milliseconds`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`profile` text NOT NULL,
	`started` integer NOT NULL,
	`finished` integer,
	`start_level` integer NOT NULL,
	`round_seconds` integer NOT NULL,
	`mode` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`rounds` integer DEFAULT 0 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`knockouts` integer DEFAULT 0 NOT NULL,
	`complete` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`profile`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_runs_profile` ON `runs` (`profile`);--> statement-breakpoint
CREATE INDEX `idx_runs_complete_score` ON `runs` (`complete`,`score`);