/**
 * Seeds 1 product / 2 sellers / 2 offers.
 * With DATABASE_URL: SQL upsert. Without: JSON fixture for tests.
 *
 *   bun run --cwd apps/api scripts/seed-multivendor-demo.ts
 */
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { drizzle } from "drizzle-orm/postgres-js"
import { sql } from "drizzle-orm"
import postgres from "postgres"
import {
  categories,
  offers,
  products,
  productVariants,
  sellers,
} from "@alkemart/db"
import { demoCatalog, snapshotToJson } from "../src/demo-seed"

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/fixtures/multivendor-demo.json",
)

async function seedSql(url: string) {
  const data = demoCatalog()
  const client = postgres(url, { max: 1 })
  const db = drizzle(client)

  const roots = data.categories.filter((r) => r.parentId === null)
  const children = data.categories.filter((r) => r.parentId !== null)
  for (const batch of [roots, children]) {
    if (batch.length === 0) continue
    await db
      .insert(categories)
      .values(batch)
      .onConflictDoUpdate({
        target: categories.handle,
        set: {
          name: sql`excluded.name`,
          rank: sql`excluded.rank`,
          parentId: sql`excluded.parent_id`,
          isNav: sql`excluded.is_nav`,
        },
      })
  }

  await db
    .insert(sellers)
    .values(data.sellers)
    .onConflictDoUpdate({
      target: sellers.handle,
      set: {
        name: sql`excluded.name`,
        status: sql`excluded.status`,
        commissionBps: sql`excluded.commission_bps`,
        deliveryFeePesewas: sql`excluded.delivery_fee_pesewas`,
      },
    })

  await db
    .insert(products)
    .values(data.products)
    .onConflictDoUpdate({
      target: products.id,
      set: {
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        status: sql`excluded.status`,
        primaryCategoryId: sql`excluded.primary_category_id`,
        sellerId: sql`excluded.seller_id`,
      },
    })

  await db
    .insert(productVariants)
    .values(data.variants)
    .onConflictDoUpdate({
      target: productVariants.id,
      set: {
        productId: sql`excluded.product_id`,
        sku: sql`excluded.sku`,
        title: sql`excluded.title`,
      },
    })

  await db
    .insert(offers)
    .values(data.offers)
    .onConflictDoUpdate({
      target: offers.id,
      set: {
        sellerId: sql`excluded.seller_id`,
        productId: sql`excluded.product_id`,
        variantId: sql`excluded.variant_id`,
        pricePesewas: sql`excluded.price_pesewas`,
        onHand: sql`excluded.on_hand`,
        reserved: sql`excluded.reserved`,
        currency: sql`excluded.currency`,
        active: sql`excluded.active`,
      },
    })

  console.log(
    `Seeded multivendor demo: ${data.products.length} product(s), ${data.sellers.length} sellers, ${data.offers.length} offers.`,
  )
  await client.end()
}

async function seedFixture() {
  await mkdir(dirname(fixturePath), { recursive: true })
  await writeFile(fixturePath, `${JSON.stringify(snapshotToJson(demoCatalog()), null, 2)}\n`)
  console.warn(`DATABASE_URL unset — wrote JSON fixture at ${fixturePath}.`)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    await seedFixture()
    return
  }
  await seedSql(url)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
