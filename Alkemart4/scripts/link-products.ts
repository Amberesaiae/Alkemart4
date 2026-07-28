import { Client } from "pg";

const SRC = "postgresql://postgres:lFNiCsDkeLxwoRXNOxSQPOYcGXBkTqRo@sakura.proxy.rlwy.net:22053/railway";
const TGT = "postgresql://neondb_owner:npg_FVzAliU4qv2j@ep-blue-mud-aykv89zz.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function fixProducts() {
  const src = new Client({ connectionString: SRC, ssl: { rejectUnauthorized: false } });
  await src.connect();

  // Get default sales channel
  const { rows: sc } = await src.query('SELECT id FROM sales_channel LIMIT 1');
  const scId = sc[0].id;
  console.log("Default sales channel:", scId);

  // Get all product IDs
  const { rows: products } = await src.query("SELECT id FROM product");
  console.log(`Total products: ${products.length}`);

  // Get existing links
  const { rows: links } = await src.query(
    "SELECT product_id FROM product_sales_channel WHERE sales_channel_id = $1 AND deleted_at IS NULL",
    [scId],
  );
  const linked = new Set(links.map((r) => r.product_id));
  console.log(`Already linked: ${linked.size}`);

  // Insert missing links
  let inserted = 0;
  for (const p of products) {
    if (!linked.has(p.id)) {
      const id = "prodsc_" + p.id.replace("prod_", "");
      await src.query(
        'INSERT INTO product_sales_channel (id, product_id, sales_channel_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [id, p.id, scId],
      );
      inserted++;
    }
  }
  console.log(`Inserted ${inserted} new product-sales_channel links.`);

  // Also check the Neon (target) database — link products there too
  console.log("\nNow updating Neon target...");
  const tgt = new Client({ connectionString: TGT });
  try {
    await tgt.connect();
    const { rows: tgtProducts } = await tgt.query("SELECT id FROM product");
    console.log(`Target products: ${tgtProducts.length}`);
    for (const p of tgtProducts) {
      const id = "prodsc_" + p.id.replace("prod_", "");
      await tgt.query(
        'INSERT INTO product_sales_channel (id, product_id, sales_channel_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [id, p.id, scId],
      );
    }
    console.log("Target product-sales_channel links done.");
  } catch (e) {
    console.error("Target update failed:", (e as Error).message.substring(0, 100));
  }
  await tgt.end();

  await src.end();
  console.log("\nDone.");
}

fixProducts().catch((e) => { console.error("Fix failed:", e); process.exit(1); });
