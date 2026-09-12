CREATE TABLE "content_pages" (
  "key" text PRIMARY KEY NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "draft_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "published_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "scheduled_sections" jsonb,
  "publish_at" timestamp with time zone,
  "unpublish_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
