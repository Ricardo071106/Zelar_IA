ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "attendee_emails" text[];--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN IF NOT EXISTS "target_emails" text[];