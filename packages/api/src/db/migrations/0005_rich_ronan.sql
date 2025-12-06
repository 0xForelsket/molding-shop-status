ALTER TABLE "shifts" ADD COLUMN "break_start_time" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "break_end_time" text;--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "break_duration_minutes" integer DEFAULT 30;