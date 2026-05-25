-- =============================================================================
-- Zelar IA — schema consolidado para Supabase (PostgreSQL / public)
-- Como usar: Supabase → SQL Editor → colar tudo → Run
--
-- • Idempotente na maior parte: CREATE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS
-- • Migração legada (guest_contact_aliases): usa EXECUTE para não falhar quando a
--   tabela não existe — erro 42P01 em IF estático no PL/pgSQL.
-- • BACKUP recomendado antes em produção.
-- =============================================================================

SET search_path TO public;

-- -----------------------------------------------------------------------------
-- 0000 — base (users, events, reminders, user_settings)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "password" text NOT NULL,
  "telegram_id" text,
  "name" text,
  "email" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_username_unique" UNIQUE ("username"),
  CONSTRAINT "users_telegram_id_unique" UNIQUE ("telegram_id")
);

CREATE TABLE IF NOT EXISTS "events" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "start_date" timestamp NOT NULL,
  "end_date" timestamp,
  "location" text,
  "is_all_day" boolean DEFAULT false,
  "calendar_id" text,
  "conference_link" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "raw_data" json
);

CREATE TABLE IF NOT EXISTS "reminders" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "channel" varchar(20) NOT NULL,
  "message" text,
  "send_at" timestamp NOT NULL,
  "sent" boolean DEFAULT false NOT NULL,
  "sent_at" timestamp,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "notifications_enabled" boolean DEFAULT true,
  "reminder_times" integer[],
  "calendar_provider" varchar(20),
  "google_tokens" text,
  "apple_tokens" text,
  "language" varchar(10) DEFAULT 'pt-BR',
  "time_zone" varchar(50) DEFAULT 'America/Sao_Paulo',
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_user_id_users_id_fk') THEN
    ALTER TABLE "events"
      ADD CONSTRAINT "events_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminders_event_id_events_id_fk') THEN
    ALTER TABLE "reminders"
      ADD CONSTRAINT "reminders_event_id_events_id_fk"
      FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminders_user_id_users_id_fk') THEN
    ALTER TABLE "reminders"
      ADD CONSTRAINT "reminders_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_settings_user_id_users_id_fk') THEN
    ALTER TABLE "user_settings"
      ADD CONSTRAINT "user_settings_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 0001 — colunas Stripe / assinatura / attendees / reminder_time + payments
-- -----------------------------------------------------------------------------
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "attendee_phones" text[];
ALTER TABLE "reminders" ADD COLUMN IF NOT EXISTS "target_phones" text[];
ALTER TABLE "reminders" ADD COLUMN IF NOT EXISTS "reminder_time" integer DEFAULT 12 NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_status" text DEFAULT 'inactive';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_ends_at" timestamp;

CREATE TABLE IF NOT EXISTS "payments" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "stripe_session_id" text UNIQUE,
  "amount" integer NOT NULL,
  "currency" text DEFAULT 'brl',
  "status" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_user_id_users_id_fk') THEN
    ALTER TABLE "payments"
      ADD CONSTRAINT "payments_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 0002 — attendee_emails / target_emails
-- -----------------------------------------------------------------------------
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "attendee_emails" text[];
ALTER TABLE "reminders" ADD COLUMN IF NOT EXISTS "target_emails" text[];

-- -----------------------------------------------------------------------------
-- 0003 — Microsoft Calendar tokens
-- -----------------------------------------------------------------------------
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "microsoft_tokens" text;

-- -----------------------------------------------------------------------------
-- 0004–0006 — planilha de convidados (sem tabelas legadas)
--
-- No app Drizzle, migrações antigas criavam guest_contact_aliases e
-- user_saved_guest_emails e depois consolidavam em user_guest_contacts.
-- No Supabase costuma não existir essas tabelas — referências estáticas a elas
-- quebram o PL/pgSQL mesmo dentro de IF. Por isso este script só cria
-- user_guest_contacts diretamente (equivalente ao estado atual do código).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "user_guest_contacts" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "normalized_email" text NOT NULL,
  "canonical_email" text NOT NULL,
  "alias_names" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "user_guest_contacts" ADD CONSTRAINT "user_guest_contacts_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "user_guest_contacts_user_email"
  ON "user_guest_contacts" ("user_id", "normalized_email");

-- Migração opcional só se você ainda tiver tabelas legadas (SQL dinâmico = não falha se não existirem)
DO $mig$ BEGIN
  IF to_regclass('public.guest_contact_aliases') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO "user_guest_contacts" ("user_id", "normalized_email", "canonical_email", "alias_names", "created_at", "updated_at")
      SELECT
        "user_id",
        lower(trim("email")),
        (array_agg("email" ORDER BY "id" ASC))[1],
        coalesce(array_agg(DISTINCT "alias_name") FILTER (WHERE "alias_name" IS NOT NULL AND btrim("alias_name") <> ''), ARRAY[]::text[]),
        now(),
        now()
      FROM "guest_contact_aliases"
      GROUP BY "user_id", lower(trim("email"))
    $q$;
  END IF;
END $mig$;

DO $mig2$ BEGIN
  IF to_regclass('public.user_saved_guest_emails') IS NOT NULL THEN
    EXECUTE $q$
      INSERT INTO "user_guest_contacts" ("user_id", "normalized_email", "canonical_email", "alias_names", "created_at", "updated_at")
      SELECT "user_id", "normalized_email", "canonical_email", ARRAY[]::text[], "created_at", "updated_at"
      FROM "user_saved_guest_emails"
      ON CONFLICT ("user_id", "normalized_email") DO UPDATE SET
        "canonical_email" = EXCLUDED."canonical_email",
        "updated_at" = EXCLUDED."updated_at"
    $q$;
  END IF;
END $mig2$;

DROP TABLE IF EXISTS "guest_contact_aliases";
DROP TABLE IF EXISTS "user_saved_guest_emails";

-- -----------------------------------------------------------------------------
-- 0007 — telefone convidado / identity_notified
-- -----------------------------------------------------------------------------
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "guest_phone_e164" text;
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "identity_notified_at" timestamp;

-- -----------------------------------------------------------------------------
-- 0008 — email opcional + índices parciais únicos
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS "user_guest_contacts_user_email";

ALTER TABLE "user_guest_contacts" ALTER COLUMN "normalized_email" DROP NOT NULL;
ALTER TABLE "user_guest_contacts" ALTER COLUMN "canonical_email" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_guest_contacts_user_email_partial"
  ON "user_guest_contacts" ("user_id", "normalized_email")
  WHERE "normalized_email" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "user_guest_contacts_user_phone_partial"
  ON "user_guest_contacts" ("user_id", "guest_phone_e164")
  WHERE "guest_phone_e164" IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 0009 — system_calendar_integrations (conta Google serviço / tokens JSON)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_calendar_integrations (
  id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  integration_key varchar(128) NOT NULL,
  provider varchar(32) NOT NULL,
  account_email text,
  tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_calendar_integrations_key_provider UNIQUE (integration_key, provider)
);

CREATE INDEX IF NOT EXISTS idx_system_calendar_integrations_key
  ON public.system_calendar_integrations (integration_key);

-- -----------------------------------------------------------------------------
-- 0010 — grupos de contatos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user_contact_groups" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "name" text NOT NULL,
  "normalized_name" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "user_contact_groups" ADD CONSTRAINT "user_contact_groups_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "user_contact_groups_user_norm_name"
  ON "user_contact_groups" ("user_id", "normalized_name");

CREATE TABLE IF NOT EXISTS "user_contact_group_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL,
  "contact_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "user_contact_group_members" ADD CONSTRAINT "user_contact_group_members_group_id_fk"
    FOREIGN KEY ("group_id") REFERENCES "public"."user_contact_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_contact_group_members" ADD CONSTRAINT "user_contact_group_members_contact_id_fk"
    FOREIGN KEY ("contact_id") REFERENCES "public"."user_guest_contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "user_contact_group_members_g_c"
  ON "user_contact_group_members" ("group_id", "contact_id");

-- -----------------------------------------------------------------------------
-- 0011 — MVP financeiro / alunos (user_guest_contacts)
-- -----------------------------------------------------------------------------
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "student_type" varchar(64);
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "monthly_amount_cents" integer;
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "package_lessons_total" integer;
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "remaining_lessons" integer;
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "financial_status" varchar(32) NOT NULL DEFAULT 'pendente';
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "notes" text;

-- -----------------------------------------------------------------------------
-- 0012 — Pluggy + pacotes de aula (user_settings / events)
-- -----------------------------------------------------------------------------
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
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_student_contact_id_fk') THEN
    ALTER TABLE "events"
      ADD CONSTRAINT "events_student_contact_id_fk"
      FOREIGN KEY ("student_contact_id") REFERENCES "public"."user_guest_contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 0013 — dedupe transações Pluggy
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "pluggy_processed_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "transaction_id" varchar(128) NOT NULL,
  "processed_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "pluggy_processed_transactions_user_tx_unique" UNIQUE ("user_id", "transaction_id")
);

CREATE INDEX IF NOT EXISTS "pluggy_processed_transactions_user_id_idx"
  ON "pluggy_processed_transactions" ("user_id");

-- -----------------------------------------------------------------------------
-- 0014 — senha do painel web (hash scrypt no app)
-- -----------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "panel_password_hash" text;

-- -----------------------------------------------------------------------------
-- 0015 — Pluggy: soma cumulativa de créditos por aluno (após primeira aula)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "pluggy_contact_payment_ledger" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "contact_id" integer NOT NULL REFERENCES "user_guest_contacts"("id") ON DELETE CASCADE,
  "transaction_id" varchar(128) NOT NULL,
  "amount_cents" integer NOT NULL CHECK ("amount_cents" > 0),
  "tx_posted_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "pluggy_contact_payment_ledger_user_tx_unique" UNIQUE ("user_id", "transaction_id")
);

CREATE INDEX IF NOT EXISTS "pluggy_contact_payment_ledger_user_contact_posted_idx"
  ON "pluggy_contact_payment_ledger" ("user_id", "contact_id", "tx_posted_at");

-- -----------------------------------------------------------------------------
-- 0019 — Histórico de upload de comprovantes PIX
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "payment_receipt_uploads" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "dedupe_key" varchar(128) NOT NULL,
  "contact_id" integer REFERENCES "user_guest_contacts"("id") ON DELETE SET NULL,
  "amount_cents" integer,
  "original_filename" varchar(255),
  "status" varchar(32) NOT NULL,
  "detail" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payment_receipt_uploads_user_created_idx"
  ON "payment_receipt_uploads" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "payment_receipt_uploads_user_dedupe_idx"
  ON "payment_receipt_uploads" ("user_id", "dedupe_key");

-- -----------------------------------------------------------------------------
-- 0016 — Pacotes de aula por usuário (planilha relacional)
-- -----------------------------------------------------------------------------
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

COMMENT ON TABLE "user_lesson_packages" IS 'Pacotes nomeados de aulas por organizador; slug = id do painel/WhatsApp.';

-- -----------------------------------------------------------------------------
-- 0017 — Cancelamento lógico e saldo retido
-- -----------------------------------------------------------------------------
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz;

CREATE INDEX IF NOT EXISTS "events_user_cancelled_start_idx"
  ON "events" ("user_id", "cancelled_at", "start_date");

ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "lesson_balance_cents" integer NOT NULL DEFAULT 0;

-- -----------------------------------------------------------------------------
-- 0018 — CPF/CNPJ do pagador (hash; nunca documento puro)
-- -----------------------------------------------------------------------------
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "payer_tax_id_hash" text;
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "payer_tax_id_last4" varchar(4);

CREATE INDEX IF NOT EXISTS "user_guest_contacts_user_tax_hash_idx"
  ON "user_guest_contacts" ("user_id", "payer_tax_id_hash")
  WHERE "payer_tax_id_hash" IS NOT NULL;

-- =============================================================================
-- Fim. Opcional: habilitar RLS nas tabelas públicas se expuser API direta ao
-- Supabase — o backend Node atual usa service role / pooler e não depende de RLS.
-- =============================================================================
