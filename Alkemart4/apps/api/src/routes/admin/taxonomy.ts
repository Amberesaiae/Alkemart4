import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { TaxonomyTransitionError } from "@alkemart/domain"
import { z } from "zod"
import { CatalogConflictError, CatalogValidationError } from "../../catalog-repository"
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
