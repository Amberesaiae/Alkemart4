/**
 * Pilot: demo/test shops' products stay visible but can't be bought — every
 * offer of the named shops is set out of stock, so only real shop owners'
 * listings sell. Out-of-stock products keep their page and shelf spot
 * (isListable), but add-to-cart and checkout refuse them (isSellable).
 *
 *   # 1. See every shop and its stock (changes nothing):
 *   DATABASE_URL=<url> bun scripts/pilot-stock-out-demo.ts
 *
 *   # 2. Stock out the shops you confirm are demo/test (by handle):
 *   DATABASE_URL=<url> bun scripts/pilot-stock-out-demo.ts --apply --shops=seller-a,seller-b
 *
 * --apply writes a backup of every changed offer's previous stock to
 * scripts/.stock-backup-<timestamp>.json first (gitignored), then updates in
 * one transaction. Restore with:
 *   DATABASE_URL=<url> bun scripts/pilot-stock-out-demo.ts --apply --restore=<backup file>
 *
 * Also rotate the demo accounts' passwords (docs/DEMO-ACCOUNTS.md): a demo
 * seller who can still sign in could restock.
 */
import postgres from "postgres"
import { writeFileSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createHash } from "node:crypto"

const url = process.env.DATABASE_URL
if (!url) throw new Error("DATABASE_URL is required")
const args = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=") as [string, string | undefined]))
const sql = postgres(url, { max: 1 })
const target = new URL(url)
const databaseFingerprint = createHash("sha256").update(`${target.hostname}:${target.port}:${target.username}:${target.pathname}`).digest("hex")
type StockRow = { id: string; on_hand: number; reserved: number }

try {
  if (args.has("restore")) {
    if (!args.has("apply")) throw new Error("Restore changes data; pass --apply --restore=<backup file>")
    const file = args.get("restore")
    if (!file) throw new Error("--restore=<backup file> is required")
    const backup = JSON.parse(readFileSync(file, "utf8")) as { version: number; databaseFingerprint: string; rows: StockRow[] }
    if (backup.version !== 1 || backup.databaseFingerprint !== databaseFingerprint || !Array.isArray(backup.rows)) {
      throw new Error("Backup format or database target does not match. Legacy backups require manual review.")
    }
    const rows = backup.rows
    if (new Set(rows.map((r) => r.id)).size !== rows.length || rows.some((r) => typeof r.id !== "string" || !r.id || !Number.isSafeInteger(r.on_hand) || r.on_hand < 0 || r.reserved !== 0)) throw new Error("Invalid backup rows")
    await sql.begin(async (tx) => {
      for (const r of rows) {
        const updated = await tx`update offers set on_hand = ${r.on_hand} where id = ${r.id} and on_hand = 0 and reserved = 0 returning id`
        if (updated.length !== 1) throw new Error(`Offer ${r.id} changed since stock-out; restore aborted without overwriting it.`)
      }
    })
    console.log(`Restored stock on ${rows.length} offers from ${file}.`)
  } else {
    const shops = await sql<{ id: string; handle: string; name: string; status: string; offers: number; in_stock: number; units: number }[]>`
      select s.id, s.handle, s.name, s.status,
             count(o.id)::int as offers,
             count(o.id) filter (where o.on_hand > 0)::int as in_stock,
             coalesce(sum(o.on_hand), 0)::int as units
      from sellers s left join offers o on o.seller_id = s.id
      group by s.id order by s.created_at`
    console.table(shops)
    if (!args.has("apply")) {
      console.log("Dry run — nothing changed. Re-run with --apply --shops=<handle,handle> to stock out the demo/test shops.")
    } else {
      const handles = (args.get("shops") ?? "").split(",").map((h) => h.trim()).filter(Boolean)
      if (!handles.length) throw new Error("--shops=<handle,handle> is required with --apply")
      const unknown = handles.filter((h) => !shops.some((s) => s.handle === h))
      if (unknown.length) throw new Error(`Unknown shop handles: ${unknown.join(", ")}`)
      const ids = shops.filter((s) => handles.includes(s.handle)).map((s) => s.id)
      const backup = resolve(import.meta.dir, `.stock-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
      let count = 0
      await sql.begin(async (tx) => {
        const before = await tx<StockRow[]>`select id, on_hand, reserved from offers where seller_id in ${sql(ids)} for update`
        if (before.some((r) => r.reserved > 0)) throw new Error("Selected shops have reserved stock. Resolve pending checkouts first; nothing changed.")
        const rows = before.filter((r) => r.on_hand > 0)
        // The backup and write use the same locked snapshot. Never overwrite a backup.
        writeFileSync(backup, JSON.stringify({ version: 1, databaseFingerprint, handles, rows }, null, 2), { mode: 0o600, flag: "wx" })
        await tx`update offers set on_hand = 0 where seller_id in ${sql(ids)} and on_hand > 0`
        count = rows.length
      })
      console.log(`Stocked out ${count} offers for: ${handles.join(", ")}. Backup: ${backup}`)
    }
  }
} finally {
  await sql.end()
}
