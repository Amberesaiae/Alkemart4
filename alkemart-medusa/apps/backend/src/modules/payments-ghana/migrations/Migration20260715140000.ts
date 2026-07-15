import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * payment_intent table for ADR-014 payment intent foundation.
 *
 * Unique: client_reference (always).
 * Unique when set: provider_reference (partial unique index — multiple NULLs allowed).
 */
export class Migration20260715140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "payment_intent" (
        "id" text not null,
        "cart_id" text null,
        "order_id" text null,
        "client_reference" text not null,
        "provider_reference" text null,
        "amount_pesewas" integer not null,
        "currency" text not null default 'ghs',
        "status" text not null default 'initiated',
        "expires_at" timestamptz null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "payment_intent_pkey" primary key ("id")
      );`
    )

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_intent_client_reference_unique"
       ON "payment_intent" ("client_reference")
       WHERE deleted_at IS NULL;`
    )

    // Partial unique: many rows may have NULL provider_reference; non-null must be unique.
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_intent_provider_reference_unique"
       ON "payment_intent" ("provider_reference")
       WHERE provider_reference IS NOT NULL AND deleted_at IS NULL;`
    )

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_intent_order_id"
       ON "payment_intent" ("order_id")
       WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_intent_cart_id"
       ON "payment_intent" ("cart_id")
       WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_intent_status_expires_at"
       ON "payment_intent" ("status", "expires_at")
       WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_intent_deleted_at"
       ON "payment_intent" ("deleted_at")
       WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_intent" cascade;`)
  }
}
