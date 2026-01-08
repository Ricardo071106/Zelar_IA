ALTER TABLE "events" ADD COLUMN "attendee_emails" text[];--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "target_emails" text[];