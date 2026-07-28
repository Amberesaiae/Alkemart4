import { Client } from "pg";

const SRC = "postgresql://postgres:lFNiCsDkeLxwoRXNOxSQPOYcGXBkTqRo@sakura.proxy.rlwy.net:22053/railway";
const TGT = "postgresql://neondb_owner:npg_FVzAliU4qv2j@ep-blue-mud-aykv89zz.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function fix() {
  const src = new Client({ connectionString: SRC, ssl: { rejectUnauthorized: false } });
  const tgt = new Client({ connectionString: TGT });
  await src.connect();
  await tgt.connect();

  // rbac_role_policy uses policy_id -> rbac_policy.id
  // Target has 241 rbac_policy rows but with DIFFERENT IDs than source
  // Source policies were migrated but Neon migrations may have created different rows
  // Solution: delete target policies, re-insert from source, then insert rbac_role_policy

  // First: check overlap
  const { rows: srcPols } = await src.query("SELECT id FROM rbac_policy");
  const { rows: tgtPols } = await tgt.query("SELECT id FROM rbac_policy");
  const srcPolIds = new Set(srcPols.map(r => r.id));
  const tgtPolIds = new Set(tgtPols.map(r => r.id));
  const overlap = [...srcPolIds].filter(id => tgtPolIds.has(id)).length;
  const onlySrc = [...srcPolIds].filter(id => !tgtPolIds.has(id)).length;
  const onlyTgt = [...tgtPolIds].filter(id => !srcPolIds.has(id)).length;
  console.log(`rbac_policy: src=${srcPols.length}, tgt=${tgtPols.length}, overlap=${overlap}, only_src=${onlySrc}, only_tgt=${onlyTgt}`);

  // Same for roles
  const { rows: srcRoles } = await src.query("SELECT id FROM rbac_role");
  const { rows: tgtRoles } = await tgt.query("SELECT id FROM rbac_role");
  const srcRoleIds = new Set(srcRoles.map(r => r.id));
  const tgtRoleIds = new Set(tgtRoles.map(r => r.id));
  const roleOverlap = [...srcRoleIds].filter(id => tgtRoleIds.has(id)).length;
  console.log(`rbac_role: src=${srcRoles.length}, tgt=${tgtRoles.length}, overlap=${roleOverlap}`);

  // Strategy: delete target rbac policies/roles, re-migrate from source
  console.log("\nDeleting target rbac_role_policy...");
  await tgt.query("DELETE FROM rbac_role_policy");
  console.log("Deleting target rbac_role...");
  await tgt.query("DELETE FROM rbac_role");
  console.log("Deleting target rbac_policy...");
  await tgt.query("DELETE FROM rbac_policy");
  console.log("Deleting target user_rbac_role...");
  await tgt.query("DELETE FROM user_rbac_role");

  // Re-migrate rbac_policy from source
  const { rows: policies } = await src.query("SELECT * FROM rbac_policy");
  if (policies.length > 0) {
    const cols = Object.keys(policies[0]);
    const colList = cols.map(c => `"${c}"`).join(", ");
    const values: any[] = [];
    const phs: string[] = [];
    let idx = 1;
    for (const row of policies) {
      const rowPH: string[] = [];
      for (const col of cols) {
        let val = row[col];
        if (val === undefined) val = null;
        if (typeof val === "object" && val !== null) val = JSON.stringify(val);
        values.push(val);
        rowPH.push(`$${idx++}`);
      }
      phs.push(`(${rowPH.join(",")})`);
    }
    await tgt.query(`INSERT INTO rbac_policy (${colList}) VALUES ${phs.join(",")}`, values);
  }
  console.log(`rbac_policy: ${policies.length} rows inserted from source`);

  // Re-migrate rbac_role from source
  const { rows: roles } = await src.query("SELECT * FROM rbac_role");
  if (roles.length > 0) {
    const cols = Object.keys(roles[0]);
    const colList = cols.map(c => `"${c}"`).join(", ");
    const values: any[] = [];
    const phs: string[] = [];
    let idx = 1;
    for (const row of roles) {
      const rowPH: string[] = [];
      for (const col of cols) {
        let val = row[col];
        if (val === undefined) val = null;
        if (typeof val === "object" && val !== null) val = JSON.stringify(val);
        values.push(val);
        rowPH.push(`$${idx++}`);
      }
      phs.push(`(${rowPH.join(",")})`);
    }
    await tgt.query(`INSERT INTO rbac_role (${colList}) VALUES ${phs.join(",")}`, values);
  }
  console.log(`rbac_role: ${roles.length} rows inserted from source`);

  // Re-migrate rbac_role_policy
  const { rows: rolePolicies } = await src.query("SELECT * FROM rbac_role_policy");
  if (rolePolicies.length > 0) {
    const cols = Object.keys(rolePolicies[0]);
    const colList = cols.map(c => `"${c}"`).join(", ");
    const values: any[] = [];
    const phs: string[] = [];
    let idx = 1;
    for (const row of rolePolicies) {
      const rowPH: string[] = [];
      for (const col of cols) {
        let val = row[col];
        if (val === undefined) val = null;
        if (typeof val === "object" && val !== null) val = JSON.stringify(val);
        values.push(val);
        rowPH.push(`$${idx++}`);
      }
      phs.push(`(${rowPH.join(",")})`);
    }
    await tgt.query(`INSERT INTO rbac_role_policy (${colList}) VALUES ${phs.join(",")}`, values);
  }
  console.log(`rbac_role_policy: ${rolePolicies.length} rows inserted from source`);

  // Re-migrate user_rbac_role
  const { rows: userRoles } = await src.query("SELECT * FROM user_rbac_role");
  if (userRoles.length > 0) {
    const cols = Object.keys(userRoles[0]);
    const colList = cols.map(c => `"${c}"`).join(", ");
    const values: any[] = [];
    const phs: string[] = [];
    let idx = 1;
    for (const row of userRoles) {
      const rowPH: string[] = [];
      for (const col of cols) {
        let val = row[col];
        if (val === undefined) val = null;
        if (typeof val === "object" && val !== null) val = JSON.stringify(val);
        values.push(val);
        rowPH.push(`$${idx++}`);
      }
      phs.push(`(${rowPH.join(",")})`);
    }
    await tgt.query(`INSERT INTO user_rbac_role (${colList}) VALUES ${phs.join(",")}`, values);
  }
  console.log(`user_rbac_role: ${userRoles.length} rows inserted from source`);

  // Now order_item, order_shipping, order_summary — these reference orders that don't exist
  // The source only has 1 order, but child tables reference 13 different order_ids
  // These are orphaned data in the source — we need to either skip them or insert orders first
  // Let's check which orders are missing from target
  const { rows: srcOrders } = await src.query('SELECT id FROM "order"');
  const { rows: tgtOrders } = await tgt.query('SELECT id FROM "order"');
  const srcOrdSet = new Set(srcOrders.map(r => r.id));
  const tgtOrdSet = new Set(tgtOrders.map(r => r.id));
  const missingOrdIds = [...srcOrdSet].filter(id => !tgtOrdSet.has(id));
  console.log(`\nMissing orders: ${missingOrdIds.length}`);

  if (missingOrdIds.length > 0) {
    // Insert missing orders
    for (const ordId of missingOrdIds) {
      try {
        const { rows } = await src.query('SELECT * FROM "order" WHERE id = $1', [ordId]);
        const order = rows[0];
        const cols = Object.keys(order);
        const colList = cols.map(c => `"${c}"`).join(", ");
        const vals = cols.map(c => {
          const v = order[c];
          return typeof v === "object" && v !== null ? JSON.stringify(v) : v;
        });
        const ph = cols.map((_, i) => `$${i + 1}`).join(", ");
        await tgt.query(`INSERT INTO "order" (${colList}) VALUES (${ph}) ON CONFLICT DO NOTHING`, vals);
        console.log(`  order ${ordId}: ✓`);
      } catch (e: any) {
        console.error(`  order ${ordId}: FAILED — ${e.message.substring(0, 200)}`);
      }
    }
  }

  // Get valid parent order IDs from source
  const { rows: validOrders } = await src.query('SELECT id FROM "order"');
  const validOrderIds = validOrders.map(r => r.id);

  // Now try order children — only insert rows with valid parent refs
  for (const table of ["order_item", "order_shipping", "order_summary"]) {
    try {
      const parentCol = table === "order_item" ? "order_id" : table === "order_shipping" ? "order_id" : "order_id";
      await tgt.query(`DELETE FROM "${table}"`);
      const { rows } = await src.query(`SELECT * FROM "${table}"`);
      if (rows.length === 0) { console.log(`${table}: 0 rows`); continue; }
      // Filter: only rows whose parent_id exists in validOrders
      const validRows = rows.filter(r => validOrderIds.includes(r[parentCol]));
      const skipped = rows.length - validRows.length;
      if (validRows.length === 0) { console.log(`${table}: 0 valid rows (${skipped} orphaned)`); continue; }
      const cols = Object.keys(validRows[0]);
      const colList = cols.map(c => `"${c}"`).join(", ");
      const values: any[] = [];
      const phs: string[] = [];
      let idx = 1;
      for (const row of validRows) {
        const rowPH: string[] = [];
        for (const col of cols) {
          let val = row[col];
          if (val === undefined) val = null;
          if (typeof val === "object" && val !== null) val = JSON.stringify(val);
          values.push(val);
          rowPH.push(`$${idx++}`);
        }
        phs.push(`(${rowPH.join(",")})`);
      }
      const CHUNK = 500;
      for (let i = 0; i < phs.length; i += CHUNK) {
        const chunk = phs.slice(i, i + CHUNK);
        const chunkVals = values.slice(cols.length * i, cols.length * (i + CHUNK));
        await tgt.query(`INSERT INTO "${table}" (${colList}) VALUES ${chunk.join(",")}`, chunkVals);
      }
      const { rows: cnt } = await tgt.query(`SELECT count(*) FROM "${table}"`);
      console.log(`${table}: ${cnt[0].count} rows (${skipped} orphaned skipped)`);
    } catch (e: any) {
      console.error(`${table}: FAILED — ${e.message.substring(0, 200)}`);
    }
  }

  await src.end();
  await tgt.end();
  console.log("\nFix complete.");
}

fix().catch(e => { console.error("Fix failed:", e); process.exit(1); });
