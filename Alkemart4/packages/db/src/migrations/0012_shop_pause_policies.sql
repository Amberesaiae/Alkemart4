CREATE TYPE "seller_availability" AS ENUM('open', 'paused');--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "availability" "seller_availability" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "paused_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sellers" ADD COLUMN "pause_note" text;--> statement-breakpoint
CREATE TABLE "shop_policy_versions" ("id" text PRIMARY KEY NOT NULL, "seller_id" text NOT NULL, "version" integer NOT NULL, "body" jsonb NOT NULL, "effective_from" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT "shop_policy_versions_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION);--> statement-breakpoint
CREATE UNIQUE INDEX "shop_policy_versions_seller_version_uidx" ON "shop_policy_versions" ("seller_id", "version");
