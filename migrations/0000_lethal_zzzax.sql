CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`guid` text,
	`created` integer NOT NULL,
	`modified` integer NOT NULL,
	`deleted` integer
);
