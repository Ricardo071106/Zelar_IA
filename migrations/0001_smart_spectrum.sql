-- Ignored CREATE TABLE payments as it likely exists
-- CREATE TABLE "payments" ...
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "attendee_phones" text[];--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN IF NOT EXISTS "target_phones" text[];--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN IF NOT EXISTS "reminder_time" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_status" text DEFAULT 'inactive';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_ends_at" timestamp;--> statement-breakpoint
-- ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" ...