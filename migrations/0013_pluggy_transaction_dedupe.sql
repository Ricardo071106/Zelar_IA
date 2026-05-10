CREATE TABLE IF NOT EXISTS "pluggy_processed_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "transaction_id" varchar(128) NOT NULL,
  "processed_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "pluggy_processed_transactions_user_tx_unique" UNIQUE ("user_id", "transaction_id")
);

CREATE INDEX IF NOT EXISTS "pluggy_processed_transactions_user_id_idx"
  ON "pluggy_processed_transactions" ("user_id");
