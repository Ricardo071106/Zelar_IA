-- Pacotes de aula por usuário (fonte relacional; espelha o JSON do painel/WhatsApp)
CREATE TABLE IF NOT EXISTS "user_lesson_packages" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "slug" varchar(64) NOT NULL,
  "label" varchar(256) NOT NULL,
  "lessons" integer NOT NULL CHECK ("lessons" > 0 AND "lessons" <= 999),
  "price_cents" integer NOT NULL CHECK ("price_cents" >= 0),
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_lesson_packages_user_slug_unique" UNIQUE ("user_id", "slug")
);

CREATE INDEX IF NOT EXISTS "user_lesson_packages_user_id_idx"
  ON "user_lesson_packages" ("user_id");

CREATE INDEX IF NOT EXISTS "user_lesson_packages_user_sort_idx"
  ON "user_lesson_packages" ("user_id", "sort_order");

COMMENT ON TABLE "user_lesson_packages" IS 'Pacotes nomeados de aulas por organizador; slug corresponde ao campo id no painel/WhatsApp.';
