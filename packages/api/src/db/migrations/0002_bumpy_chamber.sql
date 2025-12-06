ALTER TABLE "parts" ADD COLUMN "default_machine_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parts" ADD CONSTRAINT "parts_default_machine_id_machines_machine_id_fk" FOREIGN KEY ("default_machine_id") REFERENCES "public"."machines"("machine_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "production_orders" DROP COLUMN IF EXISTS "target_cycle_time";--> statement-breakpoint
ALTER TABLE "production_orders" DROP COLUMN IF EXISTS "target_utilization";--> statement-breakpoint
ALTER TABLE "production_orders" DROP COLUMN IF EXISTS "notes";