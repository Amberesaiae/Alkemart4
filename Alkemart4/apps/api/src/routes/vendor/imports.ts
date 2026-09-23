import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { CategoryNode } from "@alkemart/domain"
import {
  CatalogConflictError,
  CatalogValidationError,
} from "../../catalog-repository"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireSeller } from "../../middleware/auth"

const MAX_ROWS = 200
const MAX_CSV_CHARS = 256_000

const REQUIRED_COLUMNS = ["title", "category", "price_ghs", "stock"] as const
const OPTIONAL_COLUMNS = [
  "description",
  "sku",
  "brand",
  "model",
  "condition",
] as const
const KNOWN_COLUMNS = new Set<string>([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS])
const CONDITIONS = new Set(["new", "locally_used", "refurbished"])

const ImportBody = z.object({
  importKey: z.string().trim().min(1).max(64),
  dryRun: z.boolean().optional(),
  csv: z.string().min(1).max(MAX_CSV_CHARS + 10_000),
})

type ParsedRow = {
  row: number
  values: Record<string, string>
}

type ValidatedRow = {
  row: number
  title: string
  description: string | null
  primaryCategoryId: string
  pricePesewas: bigint
  onHand: number
  sku: string | null
  brand: string | null
  model: string | null
  condition: string | null
}

/** Minimal RFC-4180 reader (quoted fields, escaped quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let quoted = false
  let i = 0
  while (i < text.length) {
    const ch = text[i] as string
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          quoted = false
          i += 1
        }
      } else {
        field += ch
        i += 1
      }
    } else if (ch === '"') {
      quoted = true
      i += 1
    } else if (ch === ",") {
      row.push(field)
      field = ""
      i += 1
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1
      row.push(field)
      field = ""
      rows.push(row)
      row = []
      i += 1
    } else {
      field += ch
      i += 1
    }
  }
  if (quoted) throw new HTTPException(400, { message: "malformed CSV: unbalanced quote" })
  row.push(field)
  rows.push(row)
  // Drop the trailing empty line editors leave at EOF.
  while (rows.length > 0 && rows[rows.length - 1]!.every((c) => c.trim() === "")) {
    rows.pop()
  }
  return rows
}

function flattenCategories(roots: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = []
  const walk = (nodes: CategoryNode[]) => {
    for (const n of nodes) {
      out.push(n)
      walk(n.children)
    }
  }
  walk(roots)
  return out
}

function validateRow(
  values: Record<string, string>,
  row: number,
  categories: CategoryNode[],
): { valid: ValidatedRow | null; errors: string[] } {
  const errors: string[] = []
  const title = (values.title ?? "").trim()
  if (!title) errors.push("title required")
  else if (title.length > 200) errors.push("title must be 200 characters or fewer")

  let primaryCategoryId: string | null = null
  const rawCat = (values.category ?? "").trim()
  if (!rawCat) {
    errors.push("category required")
  } else {
    const key = rawCat.toLowerCase()
    const hit = categories.find(
      (c) => c.id === rawCat || c.handle.toLowerCase() === key || c.name.toLowerCase() === key,
    )
    if (!hit) errors.push(`unknown category: ${rawCat}`)
    else if (hit.children.length > 0) errors.push(`category must be a leaf: ${rawCat}`)
    else primaryCategoryId = hit.id
  }

  let pricePesewas: bigint | null = null
  const rawPrice = (values.price_ghs ?? "").trim()
  if (!/^\d+(\.\d{1,2})?$/.test(rawPrice)) {
    errors.push("price_ghs must be a non-negative amount with at most 2 decimals")
  } else {
    // String-split parse — never float math on money: "0.29" → 29n exactly.
    const [cedis, frac = ""] = rawPrice.split(".")
    pricePesewas = BigInt(cedis) * 100n + BigInt((frac + "00").slice(0, 2))
  }

  let onHand: number | null = null
  const rawStock = (values.stock ?? "").trim()
  if (!/^\d+$/.test(rawStock)) {
    errors.push("stock must be a whole number >= 0")
  } else {
    onHand = Number(rawStock)
  }

  const description = (values.description ?? "").trim()
  if (description.length > 5000) errors.push("description must be 5000 characters or fewer")
  const sku = (values.sku ?? "").trim()
  if (sku.length > 64) errors.push("sku must be 64 characters or fewer")
  const brand = (values.brand ?? "").trim()
  if (brand.length > 120) errors.push("brand must be 120 characters or fewer")
  const model = (values.model ?? "").trim()
  if (model.length > 120) errors.push("model must be 120 characters or fewer")
  const condition = (values.condition ?? "").trim().toLowerCase()
  if (condition && !CONDITIONS.has(condition)) {
    errors.push("condition must be new, locally_used, or refurbished")
  }

  if (errors.length > 0 || !primaryCategoryId || pricePesewas == null || onHand == null) {
    return { valid: null, errors }
  }
  return {
    valid: {
      row,
      title,
      description: description || null,
      primaryCategoryId,
      pricePesewas,
      onHand,
      sku: sku || null,
      brand: brand || null,
      model: model || null,
      condition: condition || null,
    },
    errors,
  }
}

function sellerIdOrThrow(c: { get(k: "auth"): AppEnv["Variables"]["auth"] }): string {
  const sellerId = c.get("auth").sellerId
  if (!sellerId) throw new HTTPException(403, { message: "forbidden" })
  return sellerId
}

/**
 * Phase 4E — bulk CSV ingestion. Validation-first: dry-run returns per-row
 * verdicts without writing; commits create `proposed` listings (review
 * queue, never direct publish) and record the import key so replays answer
 * identically without duplicating.
 */
export const vendorImports = new Hono<AppEnv>()
  .use("*", requireSeller)
  .post("/", async (c) => {
    const parsed = ImportBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    const sellerId = sellerIdOrThrow(c)
    const { importKey, dryRun = true, csv } = parsed.data
    if (csv.length > MAX_CSV_CHARS) {
      throw new HTTPException(400, { message: `csv exceeds ${MAX_CSV_CHARS} characters` })
    }

    const table = parseCsv(csv)
    if (table.length === 0) throw new HTTPException(400, { message: "empty csv" })
    const header = (table[0] ?? []).map((h) => h.trim().toLowerCase())
    const unknown = header.filter((h) => h !== "" && !KNOWN_COLUMNS.has(h))
    if (unknown.length > 0) {
      throw new HTTPException(400, { message: `unknown columns: ${unknown.join(", ")}` })
    }
    const missing = REQUIRED_COLUMNS.filter((col) => !header.includes(col))
    if (missing.length > 0) {
      throw new HTTPException(400, { message: `missing columns: ${missing.join(", ")}` })
    }
    const dataRows = table.slice(1).filter((r) => r.some((cell) => cell.trim() !== ""))
    if (dataRows.length === 0) throw new HTTPException(400, { message: "no data rows" })
    if (dataRows.length > MAX_ROWS) {
      throw new HTTPException(400, { message: `at most ${MAX_ROWS} rows per import` })
    }
    const rows: ParsedRow[] = dataRows.map((cells, i) => {
      const values: Record<string, string> = {}
      header.forEach((col, ci) => {
        if (col !== "") values[col] = cells[ci] ?? ""
      })
      return { row: i + 1, values }
    })

    const categories = flattenCategories(await c.get("repo").listCategories())
    const verdicts = rows.map((r) => ({
      ...r,
      ...validateRow(r.values, r.row, categories),
    }))

    const store = c.get("imports")
    if (!dryRun) {
      const replay = await store.findBatch(sellerId, importKey)
      if (replay) {
        return c.json({
          importKey,
          dryRun: false,
          replayed: true,
          rowCount: replay.rowCount,
          createdCount: replay.createdCount,
          failedCount: replay.rowCount - replay.createdCount,
          rows: replay.rows,
        })
      }
    }

    type Outcome = {
      row: number
      ok: boolean
      errors: string[]
      productId: string | null
      preview?: { title: string; primaryCategoryId: string; pricePesewas: string; onHand: number } | null
    }
    const outcomes: Outcome[] = []
    for (const v of verdicts) {
      if (!v.valid) {
        outcomes.push({ row: v.row, errors: v.errors, ok: false, productId: null })
        continue
      }
      if (dryRun) {
        outcomes.push({
          row: v.row,
          ok: true,
          errors: [],
          productId: null,
          preview: {
            title: v.valid.title,
            primaryCategoryId: v.valid.primaryCategoryId,
            pricePesewas: v.valid.pricePesewas.toString(),
            onHand: v.valid.onHand,
          },
        })
        continue
      }
      try {
        const created = await c.get("repo").createVendorProduct({
          sellerId,
          title: v.valid.title,
          description: v.valid.description,
          primaryCategoryId: v.valid.primaryCategoryId,
          pricePesewas: v.valid.pricePesewas,
          onHand: v.valid.onHand,
          sku: v.valid.sku,
          identity: v.valid.brand || v.valid.model ? { brand: v.valid.brand, model: v.valid.model } : undefined,
        })
        // Imported condition rides the first offer: same rule as the
        // dashboard editor (compare-at needs provenance, so imports never
        // set one — discounts stay honest by construction).
        if (v.valid.condition) {
          const firstVariant = created.variants[0]?.variant
          if (firstVariant) {
            await c.get("repo").updateProductVariant(sellerId, created.product.id, firstVariant.id, {
              condition: v.valid.condition,
            })
          }
        }
        outcomes.push({ row: v.row, ok: true, errors: [], productId: created.product.id })
      } catch (err) {
        if (err instanceof CatalogValidationError || err instanceof CatalogConflictError) {
          outcomes.push({ row: v.row, ok: false, errors: [err.message], productId: null })
        } else {
          throw err
        }
      }
    }

    if (!dryRun) {
      await store.recordBatch(
        sellerId,
        importKey,
        outcomes.map((o) => ({ row: o.row, ok: o.ok, errors: o.errors, productId: o.productId })),
      )
    }
    const createdCount = outcomes.filter((o) => o.ok).length
    return c.json({
      importKey,
      dryRun,
      replayed: false,
      rowCount: outcomes.length,
      createdCount,
      failedCount: outcomes.length - createdCount,
      rows: outcomes,
    })
  })
