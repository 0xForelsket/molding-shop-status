CREATE TABLE IF NOT EXISTS "shift_breaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" integer NOT NULL,
	"name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_breaks" ADD CONSTRAINT "shift_breaks_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "shifts" DROP COLUMN IF EXISTS "break_start_time";--> statement-breakpoint
ALTER TABLE "shifts" DROP COLUMN IF EXISTS "break_end_time";--> statement-breakpoint
ALTER TABLE "shifts" DROP COLUMN IF EXISTS "break_duration_minutes";