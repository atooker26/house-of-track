ALTER TABLE "drops" ADD COLUMN "ships_by" date;--> statement-breakpoint
ALTER TABLE "drops" ADD COLUMN "policy" text DEFAULT '' NOT NULL;