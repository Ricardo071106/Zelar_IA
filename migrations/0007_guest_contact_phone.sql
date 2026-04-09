ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "guest_phone_e164" text;
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "identity_notified_at" timestamp;
