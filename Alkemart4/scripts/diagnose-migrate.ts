import { Client } from "pg";

const SRC = "postgresql://postgres:lFNiCsDkeLxwoRXNOxSQPOYcGXBkTqRo@sakura.proxy.rlwy.net:22053/railway";
const TGT = "postgresql://neondb_owner:npg_FVzAliU4qv2j@ep-blue-mud-aykv89zz.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function diagnose() {
  const src = new Client({ connectionString: SRC, ssl: { rejectUnauthorized: false } });
  const tgt = new Client({ connectionString: TGT });
  await src.connect();
  await tgt.connect();

  // 1. Check rbac_role_policy - maybe role_id is the problem, not policy_id
  const { rows: srcRP } = await src.query("SELECT DISTINCT role_id FROM rbac_role_policy");
  const { rows: tgtRoles } = await tgt.query("SELECT id FROM rbac_role");
  const tgtRoleSet = new Set(tgtRoles.map(r => r.id));
  const missingRoles = srcRP.filter(r => !tgtRoleSet.has(r.role_id));
  console.log("rbac_role_policy: missing role_ids in target:", missingRoles.length, "of", srcRP.length);

  // Check policy_id
  const { rows: srcRPPol } = await src.query("SELECT DISTINCT policy_id FROM rbac_role_policy");
  const { rows: tgtPols } = await tgt.query("SELECT id FROM rbac_policy");
  const tgtPolSet = new Set(tgtPols.map(r => r.id));
  const missingPols = srcRPPol.filter(r => !tgtPolSet.has(r.policy_id));
  console.log("rbac_role_policy: missing policy_ids in target:", missingPols.length, "of", srcRPPol.length);

  // 2. order_item - orphaned references
  const { rows: tgtOrdIds } = await tgt.query('SELECT id FROM "order"');
  const tgtOrdSet = new Set(tgtOrdIds.map(r => r.id));
  const { rows: oiOrders } = await src.query("SELECT DISTINCT order_id FROM order_item");
  const missingOrd = oiOrders.filter(r => !tgtOrdSet.has(r.order_id));
  console.log("order_item: refs to missing orders:", missingOrd.length, "of", oiOrders.length);

  // 3. Try inserting with explicit error
  try {
    const { rows } = await src.query("SELECT * FROM rbac_role_policy LIMIT 1");
    const cols = Object.keys(rows[0]);
    const colList = cols.map(c => `"${c}"`).join(", ");
    const vals = cols.map(c => { const v = rows[0][c]; return typeof v === "object" && v !== null ? JSON.stringify(v) : v; });
    const ph = cols.map((_, i) => `$${i + 1}`).join(", ");
    await tgt.query(`INSERT INTO rbac_role_policy (${colList}) VALUES (${ph}) ON CONFLICT DO NOTHING`, vals);
    console.log("rbac_role_policy single insert: OK");
  } catch (e) {
    console.log("rbac_role_policy single insert FAILED:", (e as Error).message.substring(0, 200));
  }

  await src.end();
  await tgt.end();
}

diagnose().catch(e => { console.error(e); process.exit(1); });
