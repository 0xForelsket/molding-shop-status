CREATE TABLE IF NOT EXISTS "downtime_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"machine_id" integer NOT NULL,
	"reason_code" text NOT NULL,
	"shift_id" integer,
	"notes" text,
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp,
	"duration_minutes" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "downtime_reasons" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "machine_parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"machine_id" integer NOT NULL,
	"part_number" text NOT NULL,
	"cavity_plan" integer DEFAULT 1,
	"target_cycle_time" real
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "machines" (
	"machine_id" serial PRIMARY KEY NOT NULL,
	"machine_name" text NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	"green" boolean DEFAULT false,
	"red" boolean DEFAULT false,
	"cycle_count" integer DEFAULT 0,
	"input_mode" text DEFAULT 'auto' NOT NULL,
	"status_updated_by" text,
	"production_order" text,
	"part_number" text,
	"part_name" text,
	"target_cycle_time" real,
	"parts_per_cycle" integer DEFAULT 1,
	"brand" text,
	"model" text,
	"serial_no" text,
	"tonnage" integer,
	"screw_diameter" real,
	"injection_weight" real,
	"is_2k" boolean DEFAULT false,
	"floor_row" text,
	"floor_position" integer,
	"last_seen" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parts" (
	"part_number" text PRIMARY KEY NOT NULL,
	"part_name" text NOT NULL,
	"product_line" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_lines" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_orders" (
	"order_number" text PRIMARY KEY NOT NULL,
	"part_number" text NOT NULL,
	"quantity_required" integer NOT NULL,
	"quantity_completed" integer DEFAULT 0,
	"machine_id" integer,
	"status" text DEFAULT 'pending',
	"due_date" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "status_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"machine_id" integer NOT NULL,
	"status" text NOT NULL,
	"cycle_count" integer,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"last_login_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_machine_id_machines_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_reason_code_downtime_reasons_code_fk" FOREIGN KEY ("reason_code") REFERENCES "public"."downtime_reasons"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "machine_parts" ADD CONSTRAINT "machine_parts_machine_id_machines_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "machine_parts" ADD CONSTRAINT "machine_parts_part_number_parts_part_number_fk" FOREIGN KEY ("part_number") REFERENCES "public"."parts"("part_number") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_part_number_parts_part_number_fk" FOREIGN KEY ("part_number") REFERENCES "public"."parts"("part_number") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_machine_id_machines_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "status_logs" ADD CONSTRAINT "status_logs_machine_id_machines_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
