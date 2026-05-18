-- Cancelamento lógico de aulas (não remove a linha; some da UI e do calendário externo).
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz;

CREATE INDEX IF NOT EXISTS "events_user_cancelled_start_idx"
  ON "events" ("user_id", "cancelled_at", "start_date");

-- Crédito em centavos (BRL) retido para próximas aulas / reembolso manual; débitos Pluggy podem abater no /buscar.
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "lesson_balance_cents" integer NOT NULL DEFAULT 0;
