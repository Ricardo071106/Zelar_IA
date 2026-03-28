CREATE TABLE IF NOT EXISTS "user_saved_guest_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"normalized_email" text NOT NULL,
	"canonical_email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_saved_guest_emails" ADD CONSTRAINT "user_saved_guest_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_saved_guest_emails_user_normalized" ON "user_saved_guest_emails" USING btree ("user_id","normalized_email");
