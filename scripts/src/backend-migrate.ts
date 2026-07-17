/**
 * Fast Medusa migrate against Neon.
 *
 * Why migrate felt endless from monorepo path:
 * - `/mnt/c/...` (WSL NTFS) makes Medusa + node_modules crawl (process stuck in `D` disk wait)
 * - Multi-retry loops re-ran the full suite after Neon TCP blips
 *
 * Fix:
 * - Prefer Linux worktree `/home/amber/alkemart-backend` (ext4) when present
 * - Single migrate pass by default (schema is incremental; re-runs skip done modules)
 * - IPv4-first DNS for Neon from WSL
 *
 *   bun run backend:sync     # rsync apps/backend → Linux worktree + bun install
 *   bun run backend:migrate  # migrate from Linux worktree when available
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const ROOT = join(import.meta.dir, "../..")
const MONOREPO_API = join(ROOT, "apps/backend/packages/api")
const LINUX_BACKEND =
  process.env.ALKEMART_BACKEND_HOME || "/home/amber/alkemart-backend"
const LINUX_API = join(LINUX_BACKEND, "packages/api")

function resolveApiDir(): { api: string; backend: string; via: string } {
  if (existsSync(join(LINUX_API, "package.json"))) {
    return { api: LINUX_API, backend: LINUX_BACKEND, via: "linux-worktree" }
  }
  return {
    api: MONOREPO_API,
    backend: join(ROOT, "apps/backend"),
    via: "monorepo (/mnt/c — slow on WSL)",
  }
}

function loadEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!existsSync(path)) {
    throw new Error(`Missing ${path} — run: bun run neon:connect`)
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

async function wake(url: string) {
  try {
    const { neon } = await import("@neondatabase/serverless")
    const sql = neon(url)
    await sql`select 1 as ok`
    console.log("Neon wake (HTTP): ok")
  } catch (e) {
    console.warn("Neon wake skipped:", (e as Error).message)
  }
}

async function main() {
  const { api, via } = resolveApiDir()
  // Prefer monorepo .env (source of truth from neon:connect), fall back to worktree
  const envPath = existsSync(join(MONOREPO_API, ".env"))
    ? join(MONOREPO_API, ".env")
    : join(api, ".env")

  const fileEnv = loadEnvFile(envPath)
  const url =
    process.env.MIGRATE_UNPOOLED === "1"
      ? fileEnv.DATABASE_URL_UNPOOLED || fileEnv.DATABASE_URL
      : fileEnv.DATABASE_URL || fileEnv.DATABASE_URL_UNPOOLED
  if (!url) throw new Error("DATABASE_URL missing — run bun run neon:connect")

  console.log(`Migrate via: ${via}`)
  console.log(`cwd: ${api}`)
  console.log(
    "DB:",
    url.replace(/:\/\/[^@]+@/, "://***@").split("?")[0],
  )

  if (via.startsWith("monorepo") && process.platform === "linux") {
    console.warn(
      "Tip: on WSL, run `bun run backend:sync` once so migrate uses /home/amber/alkemart-backend (much faster).",
    )
  }

  const attempts = Math.max(1, Number(process.env.MIGRATE_RETRIES || 1))
  let lastStatus = 1

  for (let i = 1; i <= attempts; i++) {
    if (attempts > 1) console.log(`\n=== migrate attempt ${i}/${attempts} ===`)
    const t0 = Date.now()
    await wake(url)
    await new Promise((r) => setTimeout(r, 300))

    const env = {
      ...process.env,
      ...fileEnv,
      DATABASE_URL: url,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--dns-result-order=ipv4first"]
        .filter(Boolean)
        .join(" "),
    }
    const r = spawnSync("bunx", ["medusa", "db:migrate"], {
      cwd: api,
      env,
      stdio: "inherit",
    })
    lastStatus = r.status ?? 1
    const sec = ((Date.now() - t0) / 1000).toFixed(1)
    if (lastStatus === 0) {
      console.log(`Migrations OK in ${sec}s`)
      process.exit(0)
    }
    console.warn(`Migrate failed in ${sec}s (exit ${lastStatus})`)
    if (i < attempts) await new Promise((r) => setTimeout(r, 2000))
  }

  console.error(
    "Migrate failed. Tips: redis-cli ping; bun run neon:connect; bun run backend:sync",
  )
  process.exit(lastStatus)
}

main()
