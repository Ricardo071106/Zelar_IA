ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "pluggy_auto_buscar_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "pluggy_auto_buscar_time" varchar(5) DEFAULT '21:00';

ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "pluggy_auto_buscar_last_run_at" timestamp;

ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "pluggy_auto_buscar_last_summary" varchar(255);
