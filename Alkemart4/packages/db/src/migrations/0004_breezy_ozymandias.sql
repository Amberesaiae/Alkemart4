CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('requested', 'approved', 'rejected', 'refunded');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'shipped';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'delivered';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "payout_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"payout_id" text NOT NULL,
	"order_id" text NOT NULL,
	"gross_pesewas" bigint NOT NULL,
	"commission_pesewas" bigint NOT NULL,
	"net_pesewas" bigint NOT NULL,
	CONSTRAINT "payout_lines_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"gross_pesewas" bigint NOT NULL,
	"commission_pesewas" bigint NOT NULL,
	"net_pesewas" bigint NOT NULL,
	"commission_bps" integer NOT NULL,
	"paystack_transfer_code" text,
	"paystack_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_paystack_reference_unique" UNIQUE("paystack_reference")
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"status" "return_status" DEFAULT 'requested' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payout_lines" ADD CONSTRAINT "payout_lines_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_lines" ADD CONSTRAINT "payout_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;