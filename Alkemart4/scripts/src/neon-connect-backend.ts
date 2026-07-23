/**
 * Refresh Neon connection strings for the clean-slate Mercur backend.
 *
 * Usage (from monorepo root):
 *   bun run neon:connect
 *
 * Requires: neonctl authenticated (credentials in ~/.config/neonctl).
 * Reads non-secret context from `.neon` when present.
 *
 * Writes:
 *   - apps/backend/packages/api/.env  (DATABASE_URL pooled + DATABASE_URL_UNPOOLED)
 *   - .env root DATABASE_URL (marketplace)
 *   - .neon context (no secrets)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const ROOT = join(import.meta.dir, "../..")
const PROJECT_DEFAULT = "wispy-union-10280789"
const BRANCH_DEFAULT = "medusa-prod"
const DB_DEFAULT = "alkemart_marketplace"
const BRANCH_ID_DEFAULT = "br-solitary-surf-atbn0web"
const ORG_DEFAULT = "org-broad-mouse-77761956"

type NeonCtx = {
  projectId?: string
  orgId?: string
  branchId?: string
  branchName?: string
  database?: string
  consumer?: string
}

function loadCtx(): Required<
  Pick<NeonCtx, "projectId" | "branchName" | "database" | "branchId" | "orgId">
> {
  const path = join(ROOT, ".neon")
  let ctx: NeonCtx = {}
  if (existsSync(path)) {
    try {
      ctx = JSON.parse(readFileSync(path, "utf8")) as NeonCtx
    } catch {
      /* ignore */
    }
  }
  return {
    projectId: ctx.projectId || PROJECT_DEFAULT,
    branchName: ctx.branchName || BRANCH_DEFAULT,
    database: ctx.database || DB_DEFAULT,
    branchId: ctx.branchId || BRANCH_ID_DEFAULT,
    orgId: ctx.orgId || ORG_DEFAULT,
  }
}

function neonctl(args: string[]): string {
  const r = spawnSync("neonctl", args, {
    encoding: "utf8",
    cwd: ROOT,
  })
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || "neonctl failed").trim()
    throw new Error(err)
  }
  return (r.stdout || "").trim()
}

function upsertEnv(file: string, key: string, value: string) {
  let text = existsSync(file) ? readFileSync(file, "utf8") : ""
  const re = new RegExp(`^${key}=.*$`, "m")
  if (re.test(text)) {
    text = text.replace(re, `${key}=${value}`)
  } else {
    if (text && !text.endsWith("\n")) text += "\n"
    text += `${key}=${value}\n`
  }
  writeFileSync(file, text)
}

function ensureDefaults(file: string, defaults: Record<string, string>) {
  let text = existsSync(file) ? readFileSync(file, "utf8") : ""
  for (const [k, v] of Object.entries(defaults)) {
    if (!new RegExp(`^${k}=`, "m").test(text)) {
      if (text && !text.endsWith("\n")) text += "\n"
      text += `${k}=${v}\n`
    }
  }
  writeFileSync(file, text)
}

function mask(url: string) {
  return url.replace(/:\/\/[^@]+@/, "://***@")
}

function main() {
  const ctx = loadCtx()
  console.log(
    `Neon connect → project=${ctx.projectId} branch=${ctx.branchName} db=${ctx.database}`,
  )

  // Ensure database exists (idempotent enough: ignore create errors)
  const create = spawnSync(
    "neonctl",
    [
      "databases",
      "create",
      "--project-id",
      ctx.projectId,
      "--branch",
      ctx.branchName,
      "--name",
      ctx.database,
      "--output",
      "json",
    ],
    { encoding: "utf8", cwd: ROOT },
  )
  if (create.status === 0) {
    console.log(`Created database ${ctx.database}`)
  } else {
    console.log(`Database ensure: ${(create.stderr || create.stdout || "").trim().slice(0, 120) || "exists / skipped"}`)
  }

  const strip = (url: string) =>
    url
      .replace(/&channel_binding=require/g, "")
      .replace(/\?channel_binding=require&/g, "?")
      .replace(/\?channel_binding=require/g, "")

  const pooled = strip(
    neonctl([
      "connection-string",
      ctx.branchName,
      "--project-id",
      ctx.projectId,
      "--database-name",
      ctx.database,
      "--pooled",
    ]),
  )
  const direct = strip(
    neonctl([
      "connection-string",
      ctx.branchName,
      "--project-id",
      ctx.projectId,
      "--database-name",
      ctx.database,
    ]),
  )

  console.log("Pooled:", mask(pooled))
  console.log("Direct:", mask(direct))

  const apiEnv = join(ROOT, "apps/backend/packages/api/.env")
  const template = join(ROOT, "apps/backend/packages/api/.env.template")
  if (!existsSync(apiEnv) && existsSync(template)) {
    writeFileSync(apiEnv, readFileSync(template, "utf8"))
  }

  upsertEnv(apiEnv, "DATABASE_URL", pooled)
  upsertEnv(apiEnv, "DATABASE_URL_UNPOOLED", direct)
  ensureDefaults(apiEnv, {
    STORE_CORS: "http://localhost:5175,http://localhost:8000",
    ADMIN_CORS: "http://localhost:7000,http://localhost:9000",
    VENDOR_CORS: "http://localhost:7001,http://localhost:9000",
    AUTH_CORS:
      "http://localhost:5175,http://localhost:7000,http://localhost:7001,http://localhost:9000",
    REDIS_URL: "redis://localhost:6379",
    JWT_SECRET: "dev-change-me-jwt",
    COOKIE_SECRET: "dev-change-me-cookie",
    MERCUR_VENDOR_URL: "http://localhost:9000/seller",
    FILE_BACKEND_URL: "http://localhost:9000/static",
  })
  console.log("Wrote apps/backend/packages/api/.env")

  const rootEnv = join(ROOT, ".env")
  // Preserve express URL if we are overwriting DATABASE_URL and EXPRESS missing
  if (existsSync(rootEnv)) {
    const rootText = readFileSync(rootEnv, "utf8")
    if (!/^EXPRESS_DATABASE_URL=/m.test(rootText)) {
      const m = rootText.match(/^DATABASE_URL=(.+)$/m)
      if (m && !m[1].includes("alkemart_marketplace")) {
        upsertEnv(rootEnv, "EXPRESS_DATABASE_URL", m[1].trim())
      }
    }
  }
  upsertEnv(rootEnv, "DATABASE_URL", pooled)
  console.log("Updated root .env DATABASE_URL")

  writeFileSync(
    join(ROOT, ".neon"),
    JSON.stringify(
      {
        projectId: ctx.projectId,
        orgId: ctx.orgId,
        branchId: ctx.branchId,
        branchName: ctx.branchName,
        database: ctx.database,
        consumer: "apps/backend (Mercur clean-slate)",
      },
      null,
      2,
    ) + "\n",
  )
  console.log("Updated .neon (no secrets)")
  console.log("Done. Run: bun run dev:backend")
}

main()
