ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "student_type" varchar(64);
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "monthly_amount_cents" integer;
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "package_lessons_total" integer;
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "remaining_lessons" integer;
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "financial_status" varchar(32) NOT NULL DEFAULT 'pendente';
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "notes" text;
