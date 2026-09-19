ALTER TABLE `profiles` ADD `email` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `email_key` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `verified` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `verify_token` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `verify_sent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_email` ON `profiles` (`email_key`);--> statement-breakpoint
CREATE INDEX `idx_profiles_verify` ON `profiles` (`verify_token`);
