import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * customer_role — Alkemart RBAC assignments for Medusa store customers.
 */
export class Migration20260716010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "customer_role" (
        "id" text not null,
        "customer_id" text not null,
        "role" text not null,
        "vendor_id" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "customer_role_pkey" primary key ("id")
      );`,
    )

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_customer_role_customer_id"
       ON "customer_role" ("customer_id")
       WHERE deleted_at IS NULL;`,
    )

    // Unique assignment when vendor_id is set
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_role_customer_role_vendor_unique"
       ON "customer_role" ("customer_id", "role", "vendor_id")
       WHERE deleted_at IS NULL AND vendor_id IS NOT NULL;`,
    )

    // Unique non-vendor roles (vendor_id null) — one buyer/admin/support per customer
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_role_customer_role_null_vendor_unique"
       ON "customer_role" ("customer_id", "role")
       WHERE deleted_at IS NULL AND vendor_id IS NULL;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "customer_role" cascade;`)
  }
}
