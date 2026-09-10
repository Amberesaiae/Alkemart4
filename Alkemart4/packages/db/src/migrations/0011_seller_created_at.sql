ALTER TABLE "sellers" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
