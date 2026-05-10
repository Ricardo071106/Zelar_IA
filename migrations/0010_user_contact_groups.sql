CREATE TABLE IF NOT EXISTS "user_contact_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_contact_groups" ADD CONSTRAINT "user_contact_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_contact_groups_user_norm_name" ON "user_contact_groups" USING btree ("user_id","normalized_name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_contact_group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_contact_group_members" ADD CONSTRAINT "user_contact_group_members_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."user_contact_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_contact_group_members" ADD CONSTRAINT "user_contact_group_members_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."user_guest_contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_contact_group_members_g_c" ON "user_contact_group_members" USING btree ("group_id","contact_id");
