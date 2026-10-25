CREATE TABLE `coach_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`member_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`author_name` text NOT NULL,
	`role` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
