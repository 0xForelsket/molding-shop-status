CREATE TABLE IF NOT EXISTS "production_log_scraps" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_log_id" integer NOT NULL,
	"scrap_reason_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scrap_reasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "scrap_reasons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_log_scraps" ADD CONSTRAINT "production_log_scraps_production_log_id_production_logs_id_fk" FOREIGN KEY ("production_log_id") REFERENCES "public"."production_logs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_log_scraps" ADD CONSTRAINT "production_log_scraps_scrap_reason_id_scrap_reasons_id_fk" FOREIGN KEY ("scrap_reason_id") REFERENCES "public"."scrap_reasons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
