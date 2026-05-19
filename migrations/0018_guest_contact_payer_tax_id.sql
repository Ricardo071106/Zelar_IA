-- CPF/CNPJ opcional do pagador para conciliação financeira.
-- Guardamos apenas HMAC e últimos 4 dígitos; nunca documento puro.
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "payer_tax_id_hash" text;
ALTER TABLE "user_guest_contacts" ADD COLUMN IF NOT EXISTS "payer_tax_id_last4" varchar(4);

CREATE INDEX IF NOT EXISTS "user_guest_contacts_user_tax_hash_idx"
  ON "user_guest_contacts" ("user_id", "payer_tax_id_hash")
  WHERE "payer_tax_id_hash" IS NOT NULL;
