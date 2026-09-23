import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { TaxonomyTransitionError } from "@alkemart/domain"
import { z } from "zod"
import { CatalogConflictError, CatalogValidationError, type TaxonomyNodeDto } from "../../catalog-repository"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const CreateBody = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  displayName: z.string().trim().max(120).optional().nullable(),
  slug: z.string().trim().min(1).max(120).optional().nullable(),
  handle: z.string().trim().min(1).max(120).optional().nullable(),
  parentId: z.string().min(1).optional().nullable(),
  isBrowseable: z.boolean().optional(),
  isAssignable: z.boolean().optional(),
  isNavVisible: z.boolean().optional(),
  attributeProfileId: z.string().min(1).optional().nullable(),
  sortOrder: z.number().int().optional(),
})

const PatchBody = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    displayName: z.string().trim().max(120).optional().nullable(),
    slug: z.string().trim().min(1).max(120).optional().nullable(),
    parentId: z.string().min(1).optional().nullable(),
    isBrowseable: z.boolean().optional(),
    isAssignable: z.boolean().optional(),
    isNavVisible: z.boolean().optional(),
    attributeProfileId: z.string().min(1).optional().nullable(),
    sortOrder: z.number().int().optional(),
    status: z.enum(["active"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty patch" })

const DeprecateBody = z.object({ replacementId: z.string().min(1) })

function mapTaxonomyError(err: unknown): never {
  if (err instanceof CatalogValidationError || err instanceof TaxonomyTransitionError) {
    throw new HTTPException(400, { message: err.message })
  }
  if (err instanceof CatalogConflictError) {
    throw new HTTPException(409, { message: err.message })
  }
  throw err
}

/**
 * Admin taxonomy lifecycle (Phase 1A). New nodes start `proposed`;
 * deprecation requires a live replacement — never a hard delete.
 */
export const adminTaxonomy = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/", async (c) => {
    const nodes = await c.get("repo").listTaxonomyNodes()
    return c.json({ items: nodes })
  })
  .post("/", async (c) => {
    const parsed = CreateBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const node = await c.get("repo").createTaxonomyNode(parsed.data)
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: "taxonomy.create",
        targetType: "category",
        targetId: node.id,
        detail: { code: node.code },
      })
      return c.json({ node }, 201)
    } catch (err) {
      mapTaxonomyError(err)
    }
  })
  .patch("/:id", async (c) => {
    const parsed = PatchBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const node = await c.get("repo").updateTaxonomyNode(c.req.param("id"), parsed.data)
      if (!node) throw new HTTPException(404, { message: "category not found" })
      return c.json({ node })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapTaxonomyError(err)
    }
  })
  .post("/:id/deprecate", async (c) => {
    const parsed = DeprecateBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const node = await c
        .get("repo")
        .deprecateTaxonomyNode(c.req.param("id"), parsed.data.replacementId)
      if (!node) throw new HTTPException(404, { message: "category not found" })
      await c.get("auditLog").log({
        adminUserId: c.get("auth").userId,
        action: "taxonomy.deprecate",
        targetType: "category",
        targetId: node.id,
        detail: { replacementId: parsed.data.replacementId },
      })
      return c.json({ node })
    } catch (err) {
      if (err instanceof HTTPException) throw err
      mapTaxonomyError(err)
    }
  })
  /**
   * Phase 8D — evidence pipelines for taxonomy review. Read-only proposals
   * a human approves through the endpoints above; nothing auto-applies:
   * other-bucket listings, rejected identity matches, and thin leaves
   * (fewer than 3 sellable products).
   */
  .get("/proposals/review", async (c) => {
    const repo = c.get("repo")
    const proposals: {
      kind: "other_bucket" | "failed_match" | "thin_category"
      ref: string
      reason: string
      count: number
      sample: string[]
    }[] = []
    const nodes = await repo.listTaxonomyNodes().catch((): TaxonomyNodeDto[] => [])
    const leaves = nodes.filter(
      (n) => n.status === "active" && !nodes.some((m) => m.parentId === n.id),
    )
    const other = nodes.find((n) => n.handle === "other" || n.code === "other")
    if (other) {
      const bucket = await repo
        .listCatalog({ category: other.id, limit: 50, offset: 0 })
        .catch(() => ({ items: [], total: 0 }))
      if (bucket.items.length > 0) {
        proposals.push({
          kind: "other_bucket",
          ref: other.id,
          reason: `${bucket.total} sellable product${bucket.total === 1 ? "" : "s"} sit in Other — review for proper homes`,
          count: bucket.total,
          sample: bucket.items.slice(0, 5).map((i) => i.productId),
        })
      }
    }
    for (const leaf of leaves) {
      if (leaf.handle === "other" || leaf.code === "other") continue
      const shelf = await repo
        .listCatalog({ category: leaf.id, limit: 3, offset: 0 })
        .catch(() => ({ items: [], total: 0 }))
      if (shelf.total > 0 && shelf.total < 3) {
        proposals.push({
          kind: "thin_category",
          ref: leaf.id,
          reason: `leaf "${leaf.displayName ?? leaf.canonicalName}" holds ${shelf.total} sellable products — merge or seed supply`,
          count: shelf.total,
          sample: shelf.items.map((i) => i.productId),
        })
      }
    }
    const rejected = await repo.listMatchCandidates("rejected").catch(() => [])
    for (const m of rejected.slice(0, 50)) {
      proposals.push({
        kind: "failed_match",
        ref: m.id,
        reason: `reviewers rejected merging ${m.productId} ← ${m.candidateProductId} — terminology may need a new node`,
        count: 1,
        sample: [m.productId, m.candidateProductId],
      })
    }
    return c.json({ proposals, count: proposals.length })
  })
