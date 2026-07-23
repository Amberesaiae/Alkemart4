/**
 * Sync apps/backend → Linux FS worktree for fast Medusa/Mercur I/O on WSL.
 *
 *   bun run backend:sync
 *
 * Default target: /home/amber/alkemart-backend (override with ALKEMART_BACKEND_HOME)
 */
import { existsSync, copyFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const ROOT = join(import.meta.dir, "../..")
const SRC = join(ROOT, "apps/backend")
const DST = process.env.ALKEMART_BACKEND_HOME || "/home/amber/alkemart-backend"

function run(cmd: string, args: string[], opts: { cwd?: string } = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`)
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    stdio: "inherit",
    encoding: "utf8",
  })
  if (r.status !== 0) {
    throw new Error(`${cmd} failed with exit ${r.status}`)
  }
}

function main() {
  if (!existsSync(SRC)) {
    throw new Error(`Missing ${SRC}`)
  }
  mkdirSync(DST, { recursive: true })

  run("rsync", [
    "-a",
    "--delete",
    "--exclude",
    "node_modules",
    "--exclude",
    ".medusa",
    "--exclude",
    "dist",
    "--exclude",
    ".turbo",
    `${SRC}/`,
    `${DST}/`,
  ])

  // Lockfile if present (faster reproducible install)
  const lock = join(SRC, "bun.lock")
  if (existsSync(lock)) {
    copyFileSync(lock, join(DST, "bun.lock"))
  }

  // Keep Neon env in worktree
  const envSrc = join(SRC, "packages/api/.env")
  const envDst = join(DST, "packages/api/.env")
  mkdirSync(join(DST, "packages/api"), { recursive: true })
  if (existsSync(envSrc)) {
    copyFileSync(envSrc, envDst)
    console.log("Copied packages/api/.env")
  }

  run("bun", ["install"], { cwd: DST })
  console.log(`\nSynced → ${DST}`)
  console.log("Next: bun run backend:migrate")
}

main()
