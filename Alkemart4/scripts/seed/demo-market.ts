/**
 * Demo marketplace seed — vendors, products, stock, attributes, coordinates.
 *
 * Why this exists: with three listable products the storefront cannot
 * demonstrate anything. Filters need a category where values differ, the
 * sold-out treatment needs something out of stock, and "Shops near you" needs
 * sellers with coordinates. This creates enough real-shaped catalogue for all
 * three to be visible.
 *
 * Everything it writes is tagged so it can be removed in one pass:
 *   sellers.handle LIKE 'demo-%'   ·   metadata->>'demo' = 'true'
 *
 *   seed:   DATABASE_URL=<pooler url> bun scripts/seed/demo-market.ts
 *   purge:  DATABASE_URL=<pooler url> bun scripts/seed/demo-market.ts --purge
 *
 * Images are the ones already vendored in apps/storefront/public/images —
 * nothing is fetched from the web.
 */
import postgres from "postgres"

const PURGE = process.argv.includes("--purge")
const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is required")
const sql = postgres(url, { max: 1 })
const uid = () => crypto.randomUUID()
const img = (n: string) => `/images/products/demo/${n}.jpg`

/** Real Ghanaian city coordinates, so distance sorting is meaningful. */
const VENDORS = [
  { handle: "demo-osu-electronics", name: "Osu Electronics", city: "Osu, Accra", lat: 5.5571, lng: -0.1822, region: "GH07" },
  { handle: "demo-kumasi-fabrics",  name: "Kumasi Fabrics",  city: "Kejetia, Kumasi", lat: 6.6960, lng: -1.6244, region: "GH02" },
  { handle: "demo-takoradi-home",   name: "Takoradi Home",   city: "Takoradi", lat: 4.8975, lng: -1.7603, region: "GH15" },
  { handle: "demo-tamale-grocers",  name: "Tamale Grocers",  city: "Tamale", lat: 9.4075, lng: -0.8533, region: "GH09" },
]

/** category handle → products. `stock: 0` is deliberate: the sold-out state
 *  only renders when something is actually sold out. */
const CATALOGUE: Record<string, { title: string; image: string; ghs: number; stock: number; material?: string; colour?: string }[]> = {
  phones: [
    { title: "Flagship Phone 256GB", image: "flagship-phone", ghs: 4200, stock: 6, colour: "Black" },
    { title: "Fast Powerbank 20000mAh", image: "fast-powerbank", ghs: 180, stock: 24, colour: "Black" },
    { title: "Wireless Headphones", image: "wireless-headphones", ghs: 320, stock: 0, colour: "White" },
  ],
  "tvs-audio": [
    { title: "Smart TV 43\"", image: "smart-tv", ghs: 2850, stock: 3, colour: "Black" },
  ],
  men: [
    { title: "Bomber Jacket", image: "bomber-jacket", ghs: 380, stock: 7, material: "Polyester", colour: "Black" },
    { title: "Chronograph Watch", image: "chronograph-watch", ghs: 640, stock: 2, material: "Leather", colour: "Brown" },
    { title: "Bifold Wallet", image: "bifold-wallet", ghs: 120, stock: 0, material: "Leather", colour: "Black" },
  ],
  women: [
    { title: "Authentic Kente Cloth", image: "authentic-kente", ghs: 950, stock: 4, material: "Kente", colour: "Multicolour" },
    { title: "Leather Tote", image: "leather-tote", ghs: 420, stock: 5, material: "Leather", colour: "Brown" },
    { title: "Gold Necklace", image: "gold-necklace", ghs: 1500, stock: 1, colour: "Multicolour" },
    { title: "Gold Earrings", image: "gold-earrings", ghs: 780, stock: 0, colour: "Multicolour" },
  ],
  shoes: [
    { title: "Classic Clogs", image: "classic-clogs", ghs: 210, stock: 9, material: "Polyester", colour: "Black" },
  ],
  kids: [
    { title: "Kids Cotton Tee", image: "kids-cotton-tee", ghs: 65, stock: 30, material: "Cotton", colour: "White" },
  ],
  bags: [
    { title: "Bolga Basket", image: "bolga-basket", ghs: 145, stock: 12, material: "Cotton", colour: "Multicolour" },
  ],
  "home-living": [
    { title: "Countertop Blender", image: "countertop-blender", ghs: 540, stock: 4 },
    { title: "Desk Lamp", image: "desk-lamp", ghs: 160, stock: 8 },
    { title: "Glass Containers Set", image: "glass-containers", ghs: 190, stock: 0 },
    { title: "Microfiber Cloths", image: "microfiber-cloths", ghs: 45, stock: 40 },
  ],
  staples: [
    { title: "Jasmine Rice 5kg", image: "jasmine-rice", ghs: 95, stock: 60 },
  ],
  snacks: [
    { title: "Cocoa Powder 500g", image: "cocoa-powder", ghs: 55, stock: 25 },
  ],
  beverages: [
    { title: "Roasted Coffee 1kg", image: "roasted-coffee", ghs: 210, stock: 14 },
  ],
  "health-beauty": [
    { title: "Shea Butter Balm", image: "shea-butter-balm", ghs: 70, stock: 33 },
    { title: "Starface Patches", image: "starface-patches", ghs: 85, stock: 0 },
  ],
  "pet-care": [
    { title: "Pet Care Kit", image: "pet-care-kit", ghs: 230, stock: 6 },
  ],
  automotive: [
    { title: "Cordless Tool Kit", image: "cordless-tool-kit", ghs: 890, stock: 3 },
  ],
}

async function purge() {
  const ids = (await sql.unsafe(
    `select id from sellers where handle like 'demo-%'`,
  )) as unknown as { id: string }[]
  if (ids.length === 0) return console.log("nothing to purge")
  const list = ids.map((r) => r.id)
  const products = (await sql.unsafe(
    `select id from products where seller_id = any($1)`, [list],
  )) as unknown as { id: string }[]
  const pids = products.map((p) => p.id)
  if (pids.length) {
    await sql.unsafe(`delete from product_attribute_values where product_id = any($1)`, [pids])
    await sql.unsafe(`delete from product_images where product_id = any($1)`, [pids])
  }
  await sql.unsafe(`delete from offers where seller_id = any($1)`, [list])
  await sql.unsafe(`delete from product_variants where product_id = any($1)`, [pids])
  await sql.unsafe(`delete from products where seller_id = any($1)`, [list])
  await sql.unsafe(`delete from sellers where id = any($1)`, [list])
  console.log(`purged ${list.length} demo vendors and ${pids.length} products`)
}

async function seed() {
  const defs = (await sql.unsafe(
    `select id, code from attribute_definitions where code in ('material','colour')`,
  )) as unknown as { id: string; code: string }[]
  const defBy = Object.fromEntries(defs.map((d) => [d.code, d.id]))

  const sellerIds: string[] = []
  for (const v of VENDORS) {
    const id = uid()
    await sql.unsafe(
      `insert into sellers (id, handle, name, status, availability, commission_bps,
                            delivery_fee_pesewas, pack_region, lat, lng, location_set_at, metadata)
       values ($1,$2,$3,'open','open',700,$4,$5,$6,$7, now(), $8)
       on conflict (handle) do update set lat=excluded.lat, lng=excluded.lng, status='open'
       returning id`,
      [id, v.handle, v.name, 1500, v.region, v.lat, v.lng, JSON.stringify({ demo: true, city: v.city })],
    )
    const row = (await sql.unsafe(`select id from sellers where handle=$1`, [v.handle])) as unknown as { id: string }[]
    sellerIds.push(row[0].id)
  }

  const cats = (await sql.unsafe(`select id, handle from categories`)) as unknown as { id: string; handle: string }[]
  const catBy = Object.fromEntries(cats.map((c) => [c.handle, c.id]))

  let n = 0, i = 0
  for (const [catHandle, items] of Object.entries(CATALOGUE)) {
    const categoryId = catBy[catHandle]
    if (!categoryId) { console.warn(`skip unknown category ${catHandle}`); continue }
    for (const item of items) {
      const sellerId = sellerIds[i++ % sellerIds.length]
      const productId = uid(), variantId = uid(), offerId = uid()
      const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      await sql.unsafe(
        `insert into products (id, title, description, slug, status, primary_category_id, seller_id, image_url)
         values ($1,$2,$3,$4,'published',$5,$6,$7)`,
        [productId, item.title, `${item.title} — sold by a verified Alkemart shop.`, `${slug}-${productId.slice(0,8)}`, categoryId, sellerId, img(item.image)],
      )
      await sql.unsafe(
        `insert into product_variants (id, product_id, sku, title) values ($1,$2,$3,null)`,
        [variantId, productId, `${slug}-${productId.slice(0,6)}`],
      )
      await sql.unsafe(
        `insert into offers (id, seller_id, product_id, variant_id, price_pesewas, on_hand, reserved, active, currency)
         values ($1,$2,$3,$4,$5,$6,0,true,'ghs')`,
        [offerId, sellerId, productId, variantId, String(item.ghs * 100), item.stock],
      )
      for (const [code, value] of [["material", item.material], ["colour", item.colour]] as const) {
        if (!value || !defBy[code]) continue
        await sql.unsafe(
          `insert into product_attribute_values (id, product_id, definition_id, option_values)
           values ($1,$2,$3,$4) on conflict (product_id, definition_id) do nothing`,
          [uid(), productId, defBy[code], JSON.stringify([value])],
        )
      }
      n++
    }
  }
  console.log(`seeded ${VENDORS.length} demo vendors, ${n} products`)
  const oos = Object.values(CATALOGUE).flat().filter((x) => x.stock === 0).length
  console.log(`  ${oos} deliberately out of stock, so the sold-out state is visible`)
}

try {
  if (PURGE) await purge()
  else await seed()
} finally {
  await sql.end()
}
