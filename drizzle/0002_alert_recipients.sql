CREATE TABLE "order_alert_recipients" (
	"email" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_alert_recipients" ENABLE ROW LEVEL SECURITY;
