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
