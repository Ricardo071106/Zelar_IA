CREATE TABLE IF NOT EXISTS "user_guest_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"normalized_email" text NOT NULL,
	"canonical_email" text NOT NULL,
	"alias_names" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_guest_contacts" ADD CONSTRAINT "user_guest_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_guest_contacts_user_email" ON "user_guest_contacts" USING btree ("user_id","normalized_email");
--> statement-breakpoint
DO $mig$ BEGIN
  IF to_regclass('public.guest_contact_aliases') IS NOT NULL THEN
    INSERT INTO "user_guest_contacts" ("user_id", "normalized_email", "canonical_email", "alias_names", "created_at", "updated_at")
    SELECT
      "user_id",
      lower(trim("email")),
      (array_agg("email" ORDER BY "id" ASC))[1],
      coalesce(array_agg(DISTINCT "alias_name") FILTER (WHERE "alias_name" IS NOT NULL AND btrim("alias_name") <> ''), ARRAY[]::text[]),
      now(),
      now()
    FROM "guest_contact_aliases"
    GROUP BY "user_id", lower(trim("email"));
  END IF;
END $mig$;
--> statement-breakpoint
DO $mig2$ BEGIN
  IF to_regclass('public.user_saved_guest_emails') IS NOT NULL THEN
    INSERT INTO "user_guest_contacts" ("user_id", "normalized_email", "canonical_email", "alias_names", "created_at", "updated_at")
    SELECT "user_id", "normalized_email", "canonical_email", ARRAY[]::text[], "created_at", "updated_at"
    FROM "user_saved_guest_emails"
    ON CONFLICT ("user_id", "normalized_email") DO UPDATE SET
      "canonical_email" = EXCLUDED."canonical_email",
      "updated_at" = EXCLUDED."updated_at";
  END IF;
END $mig2$;
--> statement-breakpoint
DROP TABLE IF EXISTS "guest_contact_aliases";
--> statement-breakpoint
DROP TABLE IF EXISTS "user_saved_guest_emails";
