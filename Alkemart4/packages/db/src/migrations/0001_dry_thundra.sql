CREATE TYPE "public"."seller_member_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('buyer', 'seller_member', 'admin');--> statement-breakpoint
CREATE TABLE "seller_members" (
	"user_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"role" "seller_member_role" NOT NULL,
	CONSTRAINT "seller_members_user_id_seller_id_pk" PRIMARY KEY("user_id","seller_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "seller_members" ADD CONSTRAINT "seller_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_members" ADD CONSTRAINT "seller_members_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;