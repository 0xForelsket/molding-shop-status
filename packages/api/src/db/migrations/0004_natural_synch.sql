CREATE TABLE IF NOT EXISTS "production_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"machine_id" integer NOT NULL,
	"order_number" text NOT NULL,
	"shift_id" integer NOT NULL,
	"shift_date" timestamp NOT NULL,
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
DO $$ BEGIN
 ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_machine_id_machines_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "production_logs" ADD CONSTRAINT "production_logs_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
