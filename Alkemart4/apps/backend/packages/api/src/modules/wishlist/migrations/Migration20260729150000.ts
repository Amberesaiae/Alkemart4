import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260729150000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "wishlist" (
        "id" text not null,
        "reference" text not null default 'product',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "wishlist_pkey" primary key ("id")
      );
    `)
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "wishlist";')
  }
}
