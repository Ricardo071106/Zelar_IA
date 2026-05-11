-- Créditos Pluggy por aluno: soma cumulativa após a primeira aula (created_at) para ratear aulas pagas.
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
