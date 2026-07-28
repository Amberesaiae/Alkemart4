import { Client } from "pg";

const SOURCE = "postgresql://postgres:lFNiCsDkeLxwoRXNOxSQPOYcGXBkTqRo@sakura.proxy.rlwy.net:22053/railway";
const TARGET = "postgresql://neondb_owner:npg_FVzAliU4qv2j@ep-blue-mud-aykv89zz.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

// Topological order: parent tables first, then children
const TABLE_ORDER = [
  "currency", "region", "region_country", "region_payment_provider",
  "tax_region", "tax_provider", "payment_provider",
  "sales_channel", "store", "store_currency",
  "shipping_profile", "fulfillment_provider", "fulfillment_set", "service_zone", "geo_zone",
  "stock_location", "stock_location_address",
  "seller", "seller_address", "seller_member", "member",
  "user", "user_rbac_role", "user_preference",
  "rbac_policy", "rbac_role", "rbac_role_parent", "rbac_role_policy",
  "auth_identity", "auth_password_reset_token", "auth_verification", "auth_mfa_factor", "auth_mfa_recovery_code",
  "provider_identity",
  "api_key", "publishable_api_key_sales_channel",
  "invite", "customer", "customer_address", "customer_group", "customer_group_customer", "customer_account_holder",
  "account_holder",
  "store_locale",
  "product", "product_category", "product_category_product", "product_collection",
  "product_type", "product_tag", "product_tags",
  "product_option", "product_option_value",
  "product_variant", "product_variant_option", "product_variant_option_value",
  "product_variant_product_image", "image", "product_product_option", "product_product_option_value",
  "product_seller", "product_sales_channel",
  "product_attribute", "product_attribute_value", "product_attribute_value_link",
  "price_set", "price", "price_list", "price_list_rule", "price_rule", "price_preference",
  "product_variant_price_set",
  "inventory_item", "inventory_level",
  "location_fulfillment_provider", "location_fulfillment_set",
  "fulfillment_shipping_profile_seller_seller", "fulfillment_shipping_option_seller_seller",
  "shipping_option", "shipping_option_type", "shipping_option_rule", "shipping_option_price_set",
  "sales_channel_stock_location", "stock_location_stock_location_seller_seller",
  "inventory_inventory_item_seller_seller", "offer_inventory_item",
  "offer", "offer_inventory_item", "offer_offer_pricing_price",
  "product_change", "product_change_action",
  "cart", "cart_address", "cart_line_item", "cart_line_item_adjustment",
  "cart_line_item_tax_line", "cart_shipping_method", "cart_shipping_method_adjustment",
  "cart_shipping_method_tax_line", "cart_payment_collection", "cart_promotion",
  "payment", "payment_collection", "payment_session", "payment_details",
  "payment_collection_payment_providers",
  "order", "order_address", "order_cart", "order_item", "order_line_item",
  "order_line_item_adjustment", "order_line_item_tax_line",
  "order_shipping", "order_shipping_method", "order_shipping_method_adjustment",
  "order_shipping_method_tax_line", "order_payment_collection", "order_summary",
  "order_change", "order_change_action", "order_claim", "order_claim_item", "order_claim_item_image",
  "order_exchange", "order_exchange_item",
  "order_fulfillment", "order_group", "order_group_order",
  "order_promotion", "order_seller_seller",
  "fulfillment", "fulfillment_address", "fulfillment_item", "fulfillment_label",
  "refund", "refund_reason", "return", "return_item", "return_fulfillment",
  "notification", "notification_provider",
  "seller_seller_customer_customer", "seller_seller_fulfillment_fulfillment_set",
  "seller_seller_fulfillment_service_zone", "seller_seller_payout_payout_account",
  "payout_account", "payout", "payout_payout_seller_seller", "order_order_payout_payout",
  "promotion", "promotion_campaign", "promotion_campaign_budget", "promotion_campaign_budget_usage",
  "promotion_application_method", "promotion_rule", "promotion_rule_value",
  "promotion_promotion_seller_seller", "promotion_campaign_seller_seller", "promotion_promotion_rule",
  "commission_rule", "commission_rate", "commission_rate_value", "commission_line",
  "credit_line", "order_credit_line", "order_summary",
  "layout_configuration", "view_configuration", "property_label",
  "media_image", "product_product_category_media_media_image", "product_product_collection_media_media_image",
  "mikro_orm_migrations", "script_migrations", "link_module_migrations",
  "onboarding", "professional_details",
  "return_reason",
];

async function migrate() {
  const src = new Client({ connectionString: SOURCE, ssl: { rejectUnauthorized: false } });
  const tgt = new Client({ connectionString: TARGET });
  await src.connect();
  await tgt.connect();
  console.log("Connected to both databases.");

  // Get tables with data from source
  const { rows: tables } = await src.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `);
  const srcTables = new Set(tables.map((r) => r.tablename));

  // Filter to only tables that have data
  const tablesWithData: string[] = [];
  for (const t of TABLE_ORDER) {
    if (!srcTables.has(t)) continue;
    const { rows } = await src.query(`SELECT count(*) as n FROM "${t}"`);
    if (parseInt(rows[0].n) > 0) tablesWithData.push(t);
  }
  // Add any remaining tables not in our order
  for (const t of srcTables) {
    if (tablesWithData.includes(t)) continue;
    const { rows } = await src.query(`SELECT count(*) as n FROM "${t}"`);
    if (parseInt(rows[0].n) > 0) tablesWithData.push(t);
  }

  console.log(`Found ${tablesWithData.length} tables with data.`);

  // Skip session_replication_role (Neon doesn't allow it) — rely on topological order

  let totalRows = 0;
  for (const table of tablesWithData) {
    try {
      const { rows } = await src.query(`SELECT * FROM "${table}"`);
      if (rows.length === 0) continue;

      // Get column names from first row
      const cols = Object.keys(rows[0]);
      const colList = cols.map((c) => `"${c}"`).join(", ");

      // Build bulk insert with ON CONFLICT DO NOTHING
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIdx = 1;

      for (const row of rows) {
        const rowPlaceholders: string[] = [];
        for (const col of cols) {
          let val = row[col];
          if (val === undefined) val = null;
          // Handle JSON/JSONB
          if (typeof val === "object" && val !== null) {
            val = JSON.stringify(val);
          }
          values.push(val);
          rowPlaceholders.push(`$${paramIdx++}`);
        }
        placeholders.push(`(${rowPlaceholders.join(",")})`);
      }

      // Batch insert in chunks of 500
      const CHUNK = 500;
      for (let i = 0; i < placeholders.length; i += CHUNK) {
        const chunk = placeholders.slice(i, i + CHUNK);
        const chunkValues = values.slice(
          cols.length * i,
          cols.length * (i + CHUNK),
        );
        const sql = `INSERT INTO "${table}" (${colList}) VALUES ${chunk.join(",")} ON CONFLICT DO NOTHING`;
        await tgt.query(sql, chunkValues);
      }

      totalRows += rows.length;
      console.log(`  ${table}: ${rows.length} rows ✓`);
    } catch (e: any) {
      console.error(`  ${table}: FAILED — ${e.message.substring(0, 100)}`);
    }
  }

  // Reset sequences
  for (const table of tablesWithData) {
    try {
      await tgt.query(`
        SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}" WHERE id ~ '^[0-9]+$'::text), 1));
      `);
    } catch {
      // Not all tables have serial id columns — that's fine
    }
  }

  console.log(`\nDone! Migrated ${totalRows} total rows across ${tablesWithData.length} tables.`);
  await src.end();
  await tgt.end();
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
