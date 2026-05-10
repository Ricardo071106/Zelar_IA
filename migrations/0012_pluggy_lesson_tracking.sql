ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "pluggy_item_id" varchar(128);
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "default_lesson_price_cents" integer;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "lesson_packages_json" jsonb;

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "pack_group_id" varchar(64);
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "lesson_index_in_pack" integer;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "lesson_total_in_pack" integer;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "lesson_payment_status" varchar(16) NOT NULL DEFAULT 'pendente';
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "student_contact_id" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_student_contact_id_fk'
  ) THEN
    ALTER TABLE "events"
      ADD CONSTRAINT "events_student_contact_id_fk"
      FOREIGN KEY ("student_contact_id") REFERENCES "public"."user_guest_contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
