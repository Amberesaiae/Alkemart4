CREATE TYPE "public"."order_status" AS ENUM('placed');--> statement-breakpoint
CREATE TYPE "public"."payment_intent_status" AS ENUM('initiated', 'pending', 'succeeded', 'completed', 'failed', 'expired', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('momo', 'card', 'cod');--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"qty" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" text PRIMARY KEY NOT NULL,
	"currency" text DEFAULT 'ghs' NOT NULL,
	"buyer_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_intent_id" text NOT NULL,
	"buyer_email" text NOT NULL,
	"total_pesewas" bigint NOT NULL,
	"currency" text DEFAULT 'ghs' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_groups_payment_intent_id_unique" UNIQUE("payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"product_id" text NOT NULL,
	"title" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_pesewas" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_group_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"subtotal_pesewas" bigint NOT NULL,
	"delivery_fee_pesewas" bigint NOT NULL,
	"status" "order_status" DEFAULT 'placed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_intent_status" NOT NULL,
	"amount_pesewas" bigint NOT NULL,
	"currency" text DEFAULT 'ghs' NOT NULL,
	"paystack_reference" text,
	"buyer_email" text NOT NULL,
	"momo_provider" text,
	"momo_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_intents_paystack_reference_unique" UNIQUE("paystack_reference")
);
--> statement-breakpoint
CREATE TABLE "stock_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_intent_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"qty" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_groups" ADD CONSTRAINT "order_groups_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_group_id_order_groups_id_fk" FOREIGN KEY ("order_group_id") REFERENCES "public"."order_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_cart_offer_uidx" ON "cart_items" USING btree ("cart_id","offer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_reservations_intent_offer_uidx" ON "stock_reservations" USING btree ("payment_intent_id","offer_id");