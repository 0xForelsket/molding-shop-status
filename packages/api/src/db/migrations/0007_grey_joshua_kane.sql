CREATE TABLE IF NOT EXISTS "plant_calendar" (
	"date" text PRIMARY KEY NOT NULL,
	"day_type" text DEFAULT 'working' NOT NULL,
	"week_num" integer,
	"name" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_instance_breaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_instance_id" integer NOT NULL,
	"name" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"duration_minutes" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_template_id" integer NOT NULL,
	"production_date" text NOT NULL,
	"planned_start_at" timestamp NOT NULL,
	"planned_end_at" timestamp NOT NULL,
	"actual_start_at" timestamp,
	"actual_end_at" timestamp,
	"status" text DEFAULT 'scheduled',
	"is_overtime" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "downtime_logs" DROP CONSTRAINT "downtime_logs_shift_id_shifts_id_fk";
--> statement-breakpoint
ALTER TABLE "production_logs" DROP CONSTRAINT "production_logs_shift_id_shifts_id_fk";
--> statement-breakpoint
-- Clear existing data since we're migrating to shift_instance_id (NOT NULL)
TRUNCATE TABLE "production_logs" CASCADE;
TRUNCATE TABLE "downtime_logs" CASCADE;
--> statement-breakpoint
ALTER TABLE "downtime_logs" ADD COLUMN "shift_instance_id" integer;--> statement-breakpoint
ALTER TABLE "production_logs" ADD COLUMN "shift_instance_id" integer NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_instance_breaks" ADD CONSTRAINT "shift_instance_breaks_shift_instance_id_shift_instances_id_fk" FOREIGN KEY ("shift_instance_id") REFERENCES "public"."shift_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_instances" ADD CONSTRAINT "shift_instances_shift_template_id_shifts_id_fk" FOREIGN KEY ("shift_template_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_instances" ADD CONSTRAINT "shift_instances_production_date_plant_calendar_date_fk" FOREIGN KEY ("production_date") REFERENCES "public"."plant_calendar"("date") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_shift_instance_id_shift_instances_id_fk" FOREIGN KEY ("shift_instance_id") REFERENCES "public"."shift_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_shift_instance_id_shift_instances_id_fk" FOREIGN KEY ("shift_instance_id") REFERENCES "public"."shift_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "downtime_logs" DROP COLUMN IF EXISTS "shift_id";--> statement-breakpoint
ALTER TABLE "production_logs" DROP COLUMN IF EXISTS "shift_id";--> statement-breakpoint
ALTER TABLE "production_logs" DROP COLUMN IF EXISTS "shift_date";