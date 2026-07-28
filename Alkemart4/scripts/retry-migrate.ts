import { Client } from "pg";

const SRC = "postgresql://postgres:lFNiCsDkeLxwoRXNOxSQPOYcGXBkTqRo@sakura.proxy.rlwy.net:22053/railway";
const TGT = "postgresql://neondb_owner:npg_FVzAliU4qv2j@ep-blue-mud-aykv89zz.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

// Tables that failed FK ordering — retry in correct dependency order
const RETRY_TABLES = [
  // stock_location needs stock_location_address first (already done), 
  // but stock_location also references fulfillment_provider
  "stock_location",
  // rbac_role_policy needs both rbac_role and rbac_policy (both done)
  "rbac_role_policy",
  // shipping_option needs shipping_option_type (done) and shipping_profile (done)  
  "shipping_option",
  // shipping_option_rule needs shipping_option
  "shipping_option_rule",
  // order needs order_address (done) — the FK is shipping_address_id -> order_address.id
  // Also needs customer, sales_channel, etc. — all done
  "order",
  // order dependents
  "order_item",
  "order_shipping",
  "order_summary",
  "order_summary", // may appear twice, that's fine
  "payment",
];

async function retry() {
  const src = new Client({ connectionString: SRC, ssl: { rejectUnauthorized: false } });
  const tgt = new Client({ connectionString: TGT });
  await src.connect();
  await tgt.connect();
  console.log("Connected. Retrying failed tables...\n");

  for (const table of RETRY_TABLES) {
    try {
      // Check if already migrated
      const { rows: existing } = await tgt.query(`SELECT count(*) as n FROM "${table}"`);
      const { rows: source } = await src.query(`SELECT count(*) as n FROM "${table}"`);
      if (parseInt(existing[0].n) >= parseInt(source[0].n)) {
        console.log(`  ${table}: already done (${existing[0].n} rows) — skipping`);
        continue;
      }

      const { rows } = await src.query(`SELECT * FROM "${table}"`);
      if (rows.length === 0) {
        console.log(`  ${table}: 0 rows — skipping`);
        continue;
      }

      const cols = Object.keys(rows[0]);
      const colList = cols.map((c) => `"${c}"`).join(", ");
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIdx = 1;

      for (const row of rows) {
        const rowPlaceholders: string[] = [];
        for (const col of cols) {
          let val = row[col];
          if (val === undefined) val = null;
          if (typeof val === "object" && val !== null) val = JSON.stringify(val);
          values.push(val);
          rowPlaceholders.push(`$${paramIdx++}`);
        }
        placeholders.push(`(${rowPlaceholders.join(",")})`);
      }

      const CHUNK = 500;
      for (let i = 0; i < placeholders.length; i += CHUNK) {
        const chunk = placeholders.slice(i, i + CHUNK);
        const chunkValues = values.slice(cols.length * i, cols.length * (i + CHUNK));
        const sql = `INSERT INTO "${table}" (${colList}) VALUES ${chunk.join(",")} ON CONFLICT DO NOTHING`;
        await tgt.query(sql, chunkValues);
      }

      console.log(`  ${table}: ${rows.length} rows ✓`);
    } catch (e: any) {
      console.error(`  ${table}: FAILED — ${e.message.substring(0, 150)}`);
    }
  }

  await src.end();
  await tgt.end();
  console.log("\nRetry complete.");
}

retry().catch((e) => { console.error("Retry failed:", e); process.exit(1); });
