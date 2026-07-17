import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260715111916 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "vendor" drop constraint if exists "vendor_slug_unique";`);
    this.addSql(`create table if not exists "vendor" ("id" text not null, "slug" text not null, "name" text not null, "bio" text null, "logo_url" text null, "rating_avg_x100" integer not null default 0, "rating_count" integer not null default 0, "badge_top_seller" boolean not null default false, "badge_fast_shipper" boolean not null default false, "paystack_recipient_code" text null, "commission_bps" integer not null default 700, "status" text not null default 'active', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vendor_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vendor_slug_unique" ON "vendor" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_deleted_at" ON "vendor" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "vendor_staff" ("id" text not null, "role" text not null default 'member', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vendor_staff_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vendor_staff_deleted_at" ON "vendor_staff" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "vendor" cascade;`);

    this.addSql(`drop table if exists "vendor_staff" cascade;`);
  }

}
