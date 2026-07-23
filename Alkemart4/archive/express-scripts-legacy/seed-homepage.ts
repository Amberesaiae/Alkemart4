/**
 * DEV/DEMO seed only — not run in production deploy by default.
 *
 * Seeds vendors, categories, tagged products, and homepage sections so the
 * storefront home page (`GET /homepage/sections`) renders a real hero, deals
 * grid, category row, and rails out of the box instead of an empty page.
 *
 * Idempotent: safe to re-run. Vendors/categories/products are upserted by
 * their unique `slug`; homepage sections are replaced wholesale so ordering
 * always matches this script.
 *
 * Usage: `bun run --filter scripts seed-homepage` (or equivalent) with DATABASE_URL set.
 */
import { db, vendorsTable, categoriesTable, productsTable, homepageSectionsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

async function upsertVendor(v: typeof vendorsTable.$inferInsert) {
  const [row] = await db
    .insert(vendorsTable)
    .values(v)
    .onConflictDoUpdate({ target: vendorsTable.slug, set: { name: v.name, bio: v.bio } })
    .returning();
  return row!;
}

async function upsertCategory(c: typeof categoriesTable.$inferInsert) {
  const [row] = await db
    .insert(categoriesTable)
    .values(c)
    .onConflictDoUpdate({ target: categoriesTable.slug, set: { name: c.name, sortOrder: c.sortOrder } })
    .returning();
  return row!;
}

async function upsertProduct(p: typeof productsTable.$inferInsert) {
  const [row] = await db
    .insert(productsTable)
    .values(p)
    .onConflictDoUpdate({
      target: productsTable.slug,
      set: {
        title: p.title,
        pricePesewas: p.pricePesewas,
        compareAtPesewas: p.compareAtPesewas,
        stock: p.stock,
        tag: p.tag,
        categoryId: p.categoryId,
        vendorId: p.vendorId,
        ratingAvgX100: p.ratingAvgX100,
        ratingCount: p.ratingCount,
      },
    })
    .returning();
  return row!;
}

async function main() {
  console.log("Seeding vendors...");
  const vendors = await Promise.all([
    upsertVendor({ slug: "alkemart-direct", name: "alkemart Direct", bio: "alkemart's own first-party store.", badgeTopSeller: true }),
    upsertVendor({ slug: "goldstar-electronics", name: "Goldstar Electronics", bio: "Ghana electronics retailer.", badgeFastShipper: true }),
    upsertVendor({ slug: "kente-home", name: "Kente Home & Living", bio: "Home goods and decor made in Ghana." }),
  ]);
  const [alkemartDirect, goldstar, kenteHome] = vendors;

  console.log("Seeding categories...");
  const categoryDefs = [
    { slug: "grocery", name: "Grocery", sortOrder: 1 },
    { slug: "home", name: "Home", sortOrder: 2 },
    { slug: "patio-garden", name: "Patio & Garden", sortOrder: 3 },
    { slug: "fashion", name: "Fashion", sortOrder: 4 },
    { slug: "tech", name: "Tech", sortOrder: 5 },
    { slug: "baby", name: "Baby", sortOrder: 6 },
    { slug: "toys", name: "Toys", sortOrder: 7 },
    { slug: "beauty", name: "Beauty", sortOrder: 8 },
  ];
  const categories = await Promise.all(categoryDefs.map(upsertCategory));
  const catBySlug = new Map(categories.map((c) => [c.slug, c]));

  console.log("Seeding products...");
  type Tag = "rollback" | "clearance" | "best" | "popular" | "new";
  const productDefs: {
    slug: string;
    title: string;
    brand: string;
    categorySlug: string;
    vendorId: number;
    pricePesewas: number;
    compareAtPesewas?: number;
    tag: Tag;
    ratingAvgX100: number;
    ratingCount: number;
    stock: number;
  }[] = [
    // Rollback
    { slug: "rice-5kg-jasmine", title: "Jasmine White Rice, 5kg", brand: "GoldenFields", categorySlug: "grocery", vendorId: alkemartDirect.id, pricePesewas: 4500, compareAtPesewas: 5900, tag: "rollback", ratingAvgX100: 460, ratingCount: 128, stock: 240 },
    { slug: "cooking-oil-3l", title: "Pure Vegetable Cooking Oil, 3L", brand: "Frytol", categorySlug: "grocery", vendorId: alkemartDirect.id, pricePesewas: 6200, compareAtPesewas: 7500, tag: "rollback", ratingAvgX100: 430, ratingCount: 87, stock: 150 },
    { slug: "led-bulb-4pack", title: "LED Bulb 9W Daylight, 4-Pack", brand: "Voltex", categorySlug: "home", vendorId: kenteHome.id, pricePesewas: 3200, compareAtPesewas: 4800, tag: "rollback", ratingAvgX100: 440, ratingCount: 56, stock: 300 },
    { slug: "bluetooth-earbuds", title: "Wireless Bluetooth Earbuds", brand: "SoundWave", categorySlug: "tech", vendorId: goldstar.id, pricePesewas: 12000, compareAtPesewas: 18900, tag: "rollback", ratingAvgX100: 410, ratingCount: 203, stock: 90 },
    { slug: "kids-tshirt-3pack", title: "Kids Cotton T-Shirt, 3-Pack", brand: "LittleStars", categorySlug: "baby", vendorId: kenteHome.id, pricePesewas: 4900, compareAtPesewas: 6500, tag: "rollback", ratingAvgX100: 450, ratingCount: 41, stock: 120 },
    { slug: "garden-hose-15m", title: "Expandable Garden Hose, 15m", brand: "GreenGrow", categorySlug: "patio-garden", vendorId: kenteHome.id, pricePesewas: 8900, compareAtPesewas: 11900, tag: "rollback", ratingAvgX100: 400, ratingCount: 34, stock: 60 },

    // Clearance
    { slug: "throw-pillow-set", title: "Kente-Print Throw Pillow Set", brand: "Kente Home", categorySlug: "home", vendorId: kenteHome.id, pricePesewas: 5500, compareAtPesewas: 9900, tag: "clearance", ratingAvgX100: 470, ratingCount: 62, stock: 45 },
    { slug: "sneakers-canvas", title: "Unisex Canvas Sneakers", brand: "StreetStep", categorySlug: "fashion", vendorId: alkemartDirect.id, pricePesewas: 8900, compareAtPesewas: 15900, tag: "clearance", ratingAvgX100: 390, ratingCount: 74, stock: 38 },
    { slug: "makeup-palette", title: "12-Shade Eyeshadow Palette", brand: "GlowUp", categorySlug: "beauty", vendorId: alkemartDirect.id, pricePesewas: 3900, compareAtPesewas: 6900, tag: "clearance", ratingAvgX100: 420, ratingCount: 98, stock: 70 },
    { slug: "toy-race-track", title: "Electric Race Track Set", brand: "PlayZone", categorySlug: "toys", vendorId: goldstar.id, pricePesewas: 15900, compareAtPesewas: 24900, tag: "clearance", ratingAvgX100: 460, ratingCount: 29, stock: 22 },
    { slug: "patio-umbrella", title: "9ft Market Patio Umbrella", brand: "GreenGrow", categorySlug: "patio-garden", vendorId: kenteHome.id, pricePesewas: 24900, compareAtPesewas: 38900, tag: "clearance", ratingAvgX100: 410, ratingCount: 15, stock: 12 },
    { slug: "baby-stroller", title: "Lightweight Fold-Up Baby Stroller", brand: "LittleStars", categorySlug: "baby", vendorId: kenteHome.id, pricePesewas: 45900, compareAtPesewas: 68900, tag: "clearance", ratingAvgX100: 480, ratingCount: 51, stock: 18 },

    // Best sellers
    { slug: "smartphone-a14", title: "Galaxy A14 Smartphone, 128GB", brand: "Samsung", categorySlug: "tech", vendorId: goldstar.id, pricePesewas: 189900, tag: "best", ratingAvgX100: 490, ratingCount: 512, stock: 34 },
    { slug: "blender-2speed", title: "2-Speed Countertop Blender", brand: "KitchenPro", categorySlug: "home", vendorId: alkemartDirect.id, pricePesewas: 22900, tag: "best", ratingAvgX100: 470, ratingCount: 340, stock: 65 },
    { slug: "instant-noodles-case", title: "Instant Noodles, Case of 40", brand: "Indomie", categorySlug: "grocery", vendorId: alkemartDirect.id, pricePesewas: 8900, tag: "best", ratingAvgX100: 480, ratingCount: 890, stock: 500 },
    { slug: "denim-jacket", title: "Classic Denim Jacket", brand: "UrbanFit", categorySlug: "fashion", vendorId: alkemartDirect.id, pricePesewas: 13900, tag: "best", ratingAvgX100: 450, ratingCount: 176, stock: 88 },
    { slug: "face-cream-shea", title: "Shea Butter Moisturizing Cream", brand: "PureAfrica", categorySlug: "beauty", vendorId: kenteHome.id, pricePesewas: 4500, tag: "best", ratingAvgX100: 490, ratingCount: 621, stock: 210 },
    { slug: "building-blocks-set", title: "300-Piece Building Blocks Set", brand: "PlayZone", categorySlug: "toys", vendorId: goldstar.id, pricePesewas: 9900, tag: "best", ratingAvgX100: 460, ratingCount: 244, stock: 130 },

    // Popular
    { slug: "air-fryer-5l", title: "Digital Air Fryer, 5L", brand: "KitchenPro", categorySlug: "home", vendorId: alkemartDirect.id, pricePesewas: 39900, tag: "popular", ratingAvgX100: 480, ratingCount: 402, stock: 40 },
    { slug: "wireless-charger", title: "15W Fast Wireless Charger Pad", brand: "SoundWave", categorySlug: "tech", vendorId: goldstar.id, pricePesewas: 6900, tag: "popular", ratingAvgX100: 440, ratingCount: 155, stock: 160 },
    { slug: "yoga-mat", title: "Non-Slip Yoga Mat, 6mm", brand: "FitLife", categorySlug: "beauty", vendorId: alkemartDirect.id, pricePesewas: 5900, tag: "popular", ratingAvgX100: 460, ratingCount: 118, stock: 95 },
    { slug: "school-backpack", title: "Water-Resistant School Backpack", brand: "UrbanFit", categorySlug: "fashion", vendorId: kenteHome.id, pricePesewas: 7900, tag: "popular", ratingAvgX100: 450, ratingCount: 143, stock: 75 },
    { slug: "baby-diapers-jumbo", title: "Baby Diapers, Jumbo Pack", brand: "LittleStars", categorySlug: "baby", vendorId: kenteHome.id, pricePesewas: 8900, tag: "popular", ratingAvgX100: 470, ratingCount: 267, stock: 300 },
    { slug: "solar-garden-lights", title: "Solar Garden Lights, 8-Pack", brand: "GreenGrow", categorySlug: "patio-garden", vendorId: kenteHome.id, pricePesewas: 6900, tag: "popular", ratingAvgX100: 430, ratingCount: 82, stock: 140 },

    // New
    { slug: "smartwatch-fitness", title: "Fitness Smartwatch with GPS", brand: "SoundWave", categorySlug: "tech", vendorId: goldstar.id, pricePesewas: 34900, tag: "new", ratingAvgX100: 0, ratingCount: 0, stock: 55 },
    { slug: "ankara-dress", title: "Ankara Print Wrap Dress", brand: "Kente Home", categorySlug: "fashion", vendorId: kenteHome.id, pricePesewas: 15900, tag: "new", ratingAvgX100: 0, ratingCount: 0, stock: 30 },
    { slug: "espresso-machine", title: "Compact Espresso Machine", brand: "KitchenPro", categorySlug: "home", vendorId: alkemartDirect.id, pricePesewas: 54900, tag: "new", ratingAvgX100: 0, ratingCount: 0, stock: 20 },
    { slug: "toy-drone-mini", title: "Mini Camera Drone", brand: "PlayZone", categorySlug: "toys", vendorId: goldstar.id, pricePesewas: 24900, tag: "new", ratingAvgX100: 0, ratingCount: 0, stock: 25 },
    { slug: "serum-vitamin-c", title: "Vitamin C Brightening Serum", brand: "PureAfrica", categorySlug: "beauty", vendorId: kenteHome.id, pricePesewas: 6900, tag: "new", ratingAvgX100: 0, ratingCount: 0, stock: 85 },
    { slug: "patio-lounge-chair", title: "Reclining Patio Lounge Chair", brand: "GreenGrow", categorySlug: "patio-garden", vendorId: kenteHome.id, pricePesewas: 32900, tag: "new", ratingAvgX100: 0, ratingCount: 0, stock: 15 },
  ];

  for (const p of productDefs) {
    const category = catBySlug.get(p.categorySlug)!;
    await upsertProduct({
      slug: p.slug,
      title: p.title,
      brand: p.brand,
      categoryId: category.id,
      vendorId: p.vendorId,
      pricePesewas: p.pricePesewas,
      compareAtPesewas: p.compareAtPesewas ?? null,
      stock: p.stock,
      tag: p.tag,
      ratingAvgX100: p.ratingAvgX100,
      ratingCount: p.ratingCount,
      isActive: true,
    });
  }

  console.log("Seeding homepage sections...");
  await db.execute(sql`TRUNCATE TABLE ${homepageSectionsTable} RESTART IDENTITY`);

  await db.insert(homepageSectionsTable).values([
    {
      type: "announcement_yellow",
      sortOrder: 1,
      enabled: true,
      config: {},
    },
    {
      type: "hero",
      sortOrder: 2,
      enabled: true,
      config: {
        eyebrow: "Everyday low prices",
        title: "Everyday low prices across Ghana",
        cta: "Shop deals",
      },
    },
    {
      type: "deals_grid",
      sortOrder: 3,
      enabled: true,
      config: {},
    },
    {
      type: "category_row",
      sortOrder: 4,
      enabled: true,
      config: { title: "Get it all right here" },
    },
    {
      type: "product_rail",
      sortOrder: 5,
      enabled: true,
      config: { title: "Rollback deals", tag: "rollback", count: 6, columns: 6, showAdd: true, useRealData: true },
    },
    {
      type: "hero_split",
      sortOrder: 6,
      enabled: true,
      config: {
        layout: "hero_first",
        heroTone: "surface-strong",
        heroEyebrow: "Trending now",
        heroTitle: "Best sellers shoppers keep coming back for",
        heroImagePosition: "right",
        railTitle: "Best sellers",
        railTag: "best",
        railCount: 3,
        railColumns: 3,
        showAdd: true,
      },
    },
    {
      type: "feature_grid",
      sortOrder: 7,
      enabled: true,
      config: {},
    },
    {
      type: "product_rail",
      sortOrder: 8,
      enabled: true,
      config: { title: "New arrivals", tag: "new", count: 6, columns: 6, showAdd: true, useRealData: true },
    },
    {
      type: "bento_grid",
      sortOrder: 9,
      enabled: true,
      config: {},
    },
    {
      type: "express_band",
      sortOrder: 10,
      enabled: true,
      config: {},
    },
  ]);

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
