CREATE TABLE IF NOT EXISTS "bom" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_item" text NOT NULL,
	"child_item" text NOT NULL,
	"quantity" real NOT NULL,
	"uom" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "downtime_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_center_id" integer NOT NULL,
	"reason_code" text NOT NULL,
	"shift_instance_id" integer,
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
CREATE TABLE IF NOT EXISTS "items" (
	"item_number" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"material_type" text DEFAULT 'HALB' NOT NULL,
	"uom" text DEFAULT 'PCS',
	"product_line" text,
	"supervisor_code" text,
	"image_url" text,
	"part_weight" real,
	"runner_weight" real,
	"supplier" text,
	"density" real,
	"melt_temp" real,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routing" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_center_id" integer NOT NULL,
	"item_number" text NOT NULL,
	"mold_id" text,
	"cycle_time" real,
	"output_qty" integer DEFAULT 1,
	"setup_time" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "work_centers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'injection' NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	"green" boolean DEFAULT false,
	"red" boolean DEFAULT false,
	"cycle_count" integer DEFAULT 0,
	"input_mode" text DEFAULT 'auto' NOT NULL,
	"status_updated_by" text,
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
CREATE TABLE IF NOT EXISTS "molds" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cavities" integer DEFAULT 1 NOT NULL,
	"runner_type" text,
	"gate_type" text,
	"status" text DEFAULT 'active',
	"total_shots" integer DEFAULT 0,
	"maintenance_interval" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plant_calendar" (
	"date" text PRIMARY KEY NOT NULL,
	"day_type" text DEFAULT 'working' NOT NULL,
	"week_num" integer,
	"name" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_lines" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_log_scraps" (
	"id" serial PRIMARY KEY NOT NULL,
	"production_log_id" integer NOT NULL,
	"scrap_reason_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"work_center_id" integer NOT NULL,
	"order_number" text NOT NULL,
	"shift_instance_id" integer NOT NULL,
	"quantity_produced" integer DEFAULT 0,
	"quantity_scrap" integer DEFAULT 0,
	"started_at" timestamp,
	"ended_at" timestamp,
	"status" text DEFAULT 'in_progress',
	"logged_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_orders" (
	"order_number" text PRIMARY KEY NOT NULL,
	"item_number" text NOT NULL,
	"quantity_required" integer NOT NULL,
	"quantity_completed" integer DEFAULT 0,
	"work_center_id" integer,
	"status" text DEFAULT 'pending',
	"target_cycle_time" real,
	"target_utilization" integer,
	"due_date" timestamp,
	"notes" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "production_supervisors" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true
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
CREATE TABLE IF NOT EXISTS "shift_breaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_id" integer NOT NULL,
	"name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shift_instance_breaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_instance_id" integer NOT NULL,
	"name" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL
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
	"work_center_id" integer NOT NULL,
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
 ALTER TABLE "bom" ADD CONSTRAINT "bom_parent_item_items_item_number_fk" FOREIGN KEY ("parent_item") REFERENCES "public"."items"("item_number") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bom" ADD CONSTRAINT "bom_child_item_items_item_number_fk" FOREIGN KEY ("child_item") REFERENCES "public"."items"("item_number") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_work_center_id_work_centers_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_centers"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "downtime_logs" ADD CONSTRAINT "downtime_logs_shift_instance_id_shift_instances_id_fk" FOREIGN KEY ("shift_instance_id") REFERENCES "public"."shift_instances"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "items" ADD CONSTRAINT "items_supervisor_code_production_supervisors_code_fk" FOREIGN KEY ("supervisor_code") REFERENCES "public"."production_supervisors"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routing" ADD CONSTRAINT "routing_work_center_id_work_centers_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_centers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routing" ADD CONSTRAINT "routing_item_number_items_item_number_fk" FOREIGN KEY ("item_number") REFERENCES "public"."items"("item_number") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routing" ADD CONSTRAINT "routing_mold_id_molds_id_fk" FOREIGN KEY ("mold_id") REFERENCES "public"."molds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
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
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_work_center_id_work_centers_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_centers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_order_number_production_orders_order_number_fk" FOREIGN KEY ("order_number") REFERENCES "public"."production_orders"("order_number") ON DELETE no action ON UPDATE no action;
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
DO $$ BEGIN
 ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_item_number_items_item_number_fk" FOREIGN KEY ("item_number") REFERENCES "public"."items"("item_number") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_work_center_id_work_centers_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_centers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_breaks" ADD CONSTRAINT "shift_breaks_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
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
 ALTER TABLE "status_logs" ADD CONSTRAINT "status_logs_work_center_id_work_centers_id_fk" FOREIGN KEY ("work_center_id") REFERENCES "public"."work_centers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
