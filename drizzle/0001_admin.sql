CREATE TABLE "admins" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfilled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_carrier" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "admin_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Same rule as 0000: RLS on, no policies. Only the owning app role reads it.
ALTER TABLE "admins" ENABLE ROW LEVEL SECURITY;
