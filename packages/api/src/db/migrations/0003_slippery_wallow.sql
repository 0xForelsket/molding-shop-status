ALTER TABLE "production_orders" ADD COLUMN "target_cycle_time" real;--> statement-breakpoint
ALTER TABLE "production_orders" ADD COLUMN "target_utilization" integer;--> statement-breakpoint
ALTER TABLE "production_orders" ADD COLUMN "notes" text;