import { Client } from "pg";

const SRC = "postgresql://postgres:lFNiCsDkeLxwoRXNOxSQPOYcGXBkTqRo@sakura.proxy.rlwy.net:22053/railway";
const TGT = "postgresql://neondb_owner:npg_FVzAliU4qv2j@ep-blue-mud-aykv89zz.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

const TABLES = [
  // Core data tables with data
  "product", "product_variant", "image", "product_option", "product_option_value",
  "product_variant_option", "product_variant_price_set", "product_variant_product_image",
  "product_product_option", "product_product_option_value",
  "product_category", "product_category_product", "product_collection",
  "product_type", "product_tag", "product_tags",
  "product_seller", "product_sales_channel",
  "product_attribute", "product_attribute_value", "product_attribute_value_link",
  "price_set", "price", "price_rule", "price_list", "price_list_rule", "price_preference",
  "seller", "seller_address", "seller_member", "member",
  "customer", "customer_address", "customer_group", "customer_group_customer",
  "offer", "offer_inventory_item", "offer_offer_pricing_price",
  "inventory_item", "inventory_level", "inventory_inventory_item_seller_seller",
  "currency", "region", "region_country", "region_payment_provider",
  "store", "store_currency",
  "shipping_profile", "fulfillment_provider", "fulfillment_set", "service_zone", "geo_zone",
  "stock_location", "stock_location_address", "stock_location_stock_location_seller_seller",
  "sales_channel", "publishable_api_key_sales_channel", "api_key",
  "shipping_option", "shipping_option_type", "shipping_option_rule", "shipping_option_price_set",
  "fulfillment_shipping_profile_seller_seller", "fulfillment_shipping_option_seller_seller",
  "location_fulfillment_provider", "location_fulfillment_set",
  "user", "user_rbac_role",
  "rbac_policy", "rbac_role", "rbac_role_policy",
  "auth_identity", "auth_mfa_factor", "auth_mfa_recovery_code", "auth_password_reset_token",
  "auth_verification", "provider_identity",
];

async function migrate() {
  const src = new Client({ connectionString: SRC, ssl: { rejectUnauthorized: false } });
  const tgt = new Client({ connectionString: TGT });
  await src.connect();
  console.log("Connected to source.");
  await tgt.connect();
  console.log("Connected to target.");

  let total = 0;
  for (const table of TABLES) {
    try {
      // Get source data
      const { rows } = await src.query(`SELECT * FROM "${table}"`);
      if (rows.length === 0) { console.log(`  ${table}: 0 rows — skipping`); continue; }

      // Delete target data for this table first
      await tgt.query(`DELETE FROM "${table}"`);

      const cols = Object.keys(rows[0]);
      const colList = cols.map((c) => `"${c}"`).join(", ");
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIdx = 1;

      for (const row of rows) {
        const rowPH: string[] = [];
        for (const col of cols) {
          let val = row[col];
          if (val === undefined) val = null;
          if (typeof val === "object" && val !== null) val = JSON.stringify(val);
          values.push(val);
          rowPH.push(`$${paramIdx++}`);
        }
        placeholders.push(`(${rowPH.join(",")})`);
      }

      const CHUNK = 500;
      for (let i = 0; i < placeholders.length; i += CHUNK) {
        const chunk = placeholders.slice(i, i + CHUNK);
        const chunkValues = values.slice(cols.length * i, cols.length * (i + CHUNK));
        const sql = `INSERT INTO "${table}" (${colList}) VALUES ${chunk.join(",")}`;
        await tgt.query(sql, chunkValues);
      }

      const { rows: cnt } = await tgt.query(`SELECT count(*) FROM "${table}"`);
      total += parseInt(cnt[0].count);
      console.log(`  ${table}: ${cnt[0].count} rows ✓`);
    } catch (e: any) {
      console.error(`  ${table}: FAILED — ${e.message.substring(0, 150)}`);
    }
  }

  console.log(`\nTotal: ${total} rows across ${TABLES.length} tables.`);
  await src.end();
  await tgt.end();
}

migrate().catch((e) => { console.error("Migration failed:", e); process.exit(1); });
