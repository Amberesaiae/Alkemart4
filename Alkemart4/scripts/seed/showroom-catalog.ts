/**
 * Showroom catalogue: turn the demo shops into realistic businesses with
 * described products, all out of stock (see showroom-catalog.data.ts).
 *
 *   # 1. Plan only (changes nothing):
 *   DATABASE_URL=<session-mode url> bun scripts/seed/showroom-catalog.ts
 *
 *   # 2. Apply in one transaction; writes a backup first:
 *   DATABASE_URL=<url> bun scripts/seed/showroom-catalog.ts --apply
 *
 *   # Undo (restores shops/old listings, removes what this script created
 *   # unless something already references it, e.g. an order):
 *   DATABASE_URL=<url> bun scripts/seed/showroom-catalog.ts --apply --revert=<backup file>
 *
 * Old listings are set to draft with offers off, never deleted, so past
 * orders keep their products. Hurry Ventures keeps its name, location and
 * listing titles; it only gains descriptions, a fixed photo and new items.
 */
import postgres from "postgres"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { createHash } from "node:crypto"
import { CATEGORIES, PRODUCTS, SHOPS } from "./showroom-catalog.data"

type Manifest = { sellerIds: Record<string, string>; images: Record<string, { url: string }> }
const manifest = JSON.parse(readFileSync(resolve(import.meta.dir, "showroom-catalog.images.json"), "utf8")) as Manifest

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is required")
const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=") as [string, string | undefined]))
const APPLY = args.has("apply")
const sql = postgres(url, { max: 1 })
const target = new URL(url)
const fingerprint = createHash("sha256").update(`${target.hostname}:${target.port}:${target.username}:${target.pathname}`).digest("hex")
const uid = () => crypto.randomUUID()
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const photoUrl = (key: string) => {
  const u = manifest.images[key]?.url
  if (!u) throw new Error(`No uploaded photo for "${key}"`)
  return u
}
/** Hurry Ventures is a real seller: descriptions and photo fixes only. */
const KEEP_IDENTITY = new Set(["hurry-ventures"])

type Backup = {
  version: 1
  databaseFingerprint: string
  sellers: Record<string, unknown>[]
  products: { id: string; status: string; description: string | null; attributes: unknown; product_type: string | null; image_url: string | null }[]
  offers: { id: string; active: boolean }[]
  created: { sellers: string[]; products: string[]; categories: string[] }
}

async function revert(file: string) {
  const b = JSON.parse(readFileSync(file, "utf8")) as Backup
  if (b.version !== 1 || b.databaseFingerprint !== fingerprint) throw new Error("Backup format or database target does not match.")
  await sql.begin(async (tx) => {
    for (const id of b.created.products) {
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int n from order_items oi join offers o on o.id = oi.offer_id where o.product_id = ${id}`
      if (n > 0) { console.warn(`Kept product ${id}: it has orders.`); continue }
      await tx`delete from offers where product_id = ${id}`
      await tx`delete from product_variants where product_id = ${id}`
      await tx`delete from product_images where product_id = ${id}`
      await tx`delete from products where id = ${id}`
    }
    for (const s of b.sellers) {
      await tx`update sellers set handle = ${s.handle as string}, name = ${s.name as string}, description = ${s.description as string | null},
        banner = ${s.banner as string | null}, pack_region = ${s.pack_region as string | null}, district = ${s.district as string | null},
        lat = ${s.lat as number | null}, lng = ${s.lng as number | null}, delivery_fee_pesewas = ${s.delivery_fee_pesewas as string},
        metadata = ${s.metadata === null ? null : tx.json(s.metadata as never)}, status = ${s.status as string}
        where id = ${s.id as string}`
    }
    for (const id of b.created.sellers) {
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int n from products where seller_id = ${id}`
      if (n === 0) await tx`delete from sellers where id = ${id}`
      else console.warn(`Kept seller ${id}: it still has products.`)
    }
    for (const p of b.products) {
      await tx`update products set status = ${p.status}, description = ${p.description}, attributes = ${p.attributes === null ? null : tx.json(p.attributes as never)},
        product_type = ${p.product_type}, image_url = ${p.image_url} where id = ${p.id}`
    }
    for (const o of b.offers) await tx`update offers set active = ${o.active} where id = ${o.id}`
    for (const id of [...b.created.categories].reverse()) {
      const [{ n }] = await tx<{ n: number }[]>`select (select count(*) from products where primary_category_id = ${id}) + (select count(*) from categories where parent_id = ${id}) as n`
      if (Number(n) === 0) await tx`delete from categories where id = ${id}`
    }
  })
  console.log(`Reverted from ${file}.`)
}

async function main() {
  if (args.has("revert")) {
    if (!APPLY) throw new Error("Revert changes data; pass --apply --revert=<backup file>")
    return revert(args.get("revert")!)
  }
  const handles = SHOPS.map((s) => s.fromHandle).filter((h): h is string => !!h)
  const sellers = await sql<{ id: string; handle: string; name: string }[]>`select id, handle, name from sellers where handle in ${sql(handles)}`
  const missing = handles.filter((h) => !sellers.some((s) => s.handle === h))
  if (missing.length) throw new Error(`Shops not found: ${missing.join(", ")}`)
  const newHandles = SHOPS.filter((s) => s.fromHandle !== s.handle).map((s) => s.handle)
  const taken = await sql<{ handle: string }[]>`select handle from sellers where handle in ${sql(newHandles)}`
  if (taken.length) throw new Error(`Handles already in use: ${taken.map((t) => t.handle).join(", ")}. Already applied?`)
  const cats = await sql<{ id: string; handle: string }[]>`select id, handle from categories`
  const catId = new Map(cats.map((c) => [c.handle, c.id]))

  console.table(SHOPS.map((s) => ({ from: s.fromHandle ?? "(new)", to: s.handle, name: s.name, products: PRODUCTS.filter((p) => p.shop === s.handle).length })))
  console.log(`Categories to add: ${CATEGORIES.filter((c) => !catId.has(c.handle)).map((c) => c.name).join(", ") || "none"}`)
  for (const p of PRODUCTS) for (const k of p.photos) photoUrl(k)
  if (!APPLY) { console.log("Plan only; nothing changed. Re-run with --apply."); return }

  const backup = resolve(import.meta.dir, `../.showroom-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
  const created: Backup["created"] = { sellers: [], products: [], categories: [] }
  await sql.begin(async (tx) => {
    const ids = sellers.map((s) => s.id)
    const before: Backup = {
      version: 1, databaseFingerprint: fingerprint, created,
      sellers: await tx`select * from sellers where id in ${tx(ids)} for update`,
      products: await tx`select id, status, description, attributes, product_type, image_url from products where seller_id in ${tx(ids)} for update`,
      offers: await tx`select id, active from offers where seller_id in ${tx(ids)} for update`,
    }

    // Categories (children after parents; rank after existing siblings).
    for (const c of CATEGORIES) {
      if (catId.has(c.handle)) continue
      const parentId = c.parent ? catId.get(c.parent) : null
      if (c.parent && !parentId) throw new Error(`Parent category ${c.parent} missing`)
      const [{ rank }] = await tx<{ rank: number }[]>`select coalesce(max(rank), -1)::int + 1 as rank from categories where parent_id is not distinct from ${parentId ?? null}`
      const id = uid()
      await tx`insert into categories (id, handle, name, parent_id, rank) values (${id}, ${c.handle}, ${c.name}, ${parentId ?? null}, ${rank})`
      catId.set(c.handle, id); created.categories.push(id)
    }

    // Shops.
    const sellerId = new Map<string, string>()
    for (const s of SHOPS) {
      const row = sellers.find((r) => r.handle === s.fromHandle)
      if (row && KEEP_IDENTITY.has(s.handle)) {
        await tx`update sellers set description = ${s.description} where id = ${row.id}`
        sellerId.set(s.handle, row.id)
        continue
      }
      const meta = { showroom: true, city: s.city }
      const id = row?.id ?? manifest.sellerIds[s.handle]
      if (!id) throw new Error(`No seller id for ${s.handle}`)
      if (row) {
        await tx`update sellers set handle = ${s.handle}, name = ${s.name}, description = ${s.description},
          pack_region = ${s.region}, district = ${s.district}, lat = ${s.lat}, lng = ${s.lng}, location_set_at = now(),
          delivery_fee_pesewas = ${s.deliveryFeeGhs * 100}, status = 'open', availability = 'open',
          metadata = ${tx.json(meta)}, banner = ${s.keepBanner ? tx`banner` : null}
          where id = ${id}`
        // Old listings leave the shelves but stay intact for past orders.
        await tx`update offers set active = false where seller_id = ${id}`
        await tx`update products set status = 'draft' where seller_id = ${id} and status = 'published'`
      } else {
        await tx`insert into sellers (id, handle, name, description, status, availability, commission_bps, delivery_fee_pesewas,
            pack_region, district, lat, lng, location_set_at, metadata)
          values (${id}, ${s.handle}, ${s.name}, ${s.description}, 'open', 'open', 0, ${s.deliveryFeeGhs * 100},
            ${s.region}, ${s.district}, ${s.lat}, ${s.lng}, now(), ${tx.json(meta)})`
        created.sellers.push(id)
      }
      sellerId.set(s.handle, id)
    }

    // Products.
    for (const p of PRODUCTS) {
      const sid = sellerId.get(p.shop)!
      const attributes = p.attributes.map(([label, value]) => ({ label, value }))
      const images = p.photos.map(photoUrl)
      if (p.existingTitle) {
        const [row] = await tx<{ id: string }[]>`select id from products where seller_id = ${sid} and title = ${p.existingTitle}`
        if (!row) throw new Error(`${p.shop}: listing "${p.existingTitle}" not found`)
        await tx`update products set description = ${p.description}, attributes = ${tx.json(attributes)}, product_type = ${p.productType}
          ${images[0] ? tx`, image_url = ${images[0]}` : tx``} where id = ${row.id}`
        for (const [i, u] of images.entries()) {
          await tx`insert into product_images (id, product_id, url, alt, position) values (${uid()}, ${row.id}, ${u}, ${p.title}, ${i}) on conflict do nothing`
        }
        continue
      }
      const category = catId.get(p.category)
      if (!category) throw new Error(`Category ${p.category} missing for ${p.title}`)
      if (p.ghs == null) throw new Error(`Price missing for ${p.title}`)
      const id = uid(), variantId = uid(), slug = `${slugify(p.title)}-${id.slice(0, 8)}`
      await tx`insert into products (id, title, description, slug, status, primary_category_id, seller_id, image_url, attributes, brand, product_type)
        values (${id}, ${p.title}, ${p.description}, ${slug}, 'published', ${category}, ${sid}, ${images[0]}, ${tx.json(attributes)}, ${p.brand ?? null}, ${p.productType})`
      for (const [i, u] of images.entries()) {
        await tx`insert into product_images (id, product_id, url, alt, position) values (${uid()}, ${id}, ${u}, ${p.title}, ${i})`
      }
      await tx`insert into product_variants (id, product_id, sku) values (${variantId}, ${id}, ${`${slug.slice(0, 40)}-${id.slice(0, 6)}`})`
      // Showroom: listed and visible, nothing to buy until the seller stocks it.
      await tx`insert into offers (id, seller_id, product_id, variant_id, price_pesewas, on_hand, reserved, active, currency, condition, published_at, freshness_at)
        values (${uid()}, ${sid}, ${id}, ${variantId}, ${p.ghs * 100}, 0, 0, true, 'ghs', 'new', now(), now())`
      created.products.push(id)
    }

    // Backup is written inside the transaction: if it cannot be saved, nothing commits.
    writeFileSync(backup, JSON.stringify(before, null, 2), { mode: 0o600, flag: "wx" })
  })
  console.log(`Applied: ${created.categories.length} categories, ${created.sellers.length} new shop(s), ${created.products.length} new products. Backup: ${backup}`)
}

try {
  await main()
} finally {
  await sql.end()
}
