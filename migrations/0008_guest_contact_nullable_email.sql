DROP INDEX IF EXISTS "user_guest_contacts_user_email";
ALTER TABLE "user_guest_contacts" ALTER COLUMN "normalized_email" DROP NOT NULL;
ALTER TABLE "user_guest_contacts" ALTER COLUMN "canonical_email" DROP NOT NULL;
CREATE UNIQUE INDEX "user_guest_contacts_user_email_partial" ON "user_guest_contacts" ("user_id", "normalized_email") WHERE "normalized_email" IS NOT NULL;
CREATE UNIQUE INDEX "user_guest_contacts_user_phone_partial" ON "user_guest_contacts" ("user_id", "guest_phone_e164") WHERE "guest_phone_e164" IS NOT NULL;
