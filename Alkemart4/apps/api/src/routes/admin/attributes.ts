import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { CatalogConflictError, CatalogValidationError } from "../../catalog-repository"
import type { AppEnv } from "../../context"
import { readJsonBody } from "../../lib/session"
import { requireAdmin } from "../../middleware/auth"

const DefinitionBody = z.object({
  code: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["text", "number", "boolean", "option", "multi_option"]),
  unitFamily: z.string().trim().max(40).optional().nullable(),
  allowedValues: z.array(z.string().trim().min(1).max(80)).max(100).optional().nullable(),
  filterable: z.boolean().optional(),
  searchable: z.boolean().optional(),
  required: z.boolean().optional(),
  variantAxis: z.boolean().optional(),
  visibleOnCard: z.boolean().optional(),
  visibleOnPdp: z.boolean().optional(),
  /** `universal` survives a category change; `profile` is pruned (0033). */
  scope: z.enum(["universal", "profile"]).optional(),
})

const ProfileBody = z.object({
  name: z.string().trim().min(1).max(120),
  categoryId: z.string().min(1).optional().nullable(),
  definitions: z
    .array(
      z.object({
        definitionId: z.string().min(1),
        position: z.number().int().min(0).optional(),
        required: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(100),
})

function mapAttributeError(err: unknown): never {
  if (err instanceof CatalogValidationError) {
    throw new HTTPException(400, { message: err.message })
  }
  if (err instanceof CatalogConflictError) {
    throw new HTTPException(409, { message: err.message })
  }
  throw err
}

/** Admin typed-attribute governance (Phase 1C). Values are written by vendors. */
export const adminAttributes = new Hono<AppEnv>()
  .use("*", requireAdmin)
  .get("/definitions", async (c) => {
    return c.json({ items: await c.get("repo").listAttributeDefinitions() })
  })
  .post("/definitions", async (c) => {
    const parsed = DefinitionBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const definition = await c.get("repo").createAttributeDefinition(parsed.data)
      return c.json({ definition }, 201)
    } catch (err) {
      mapAttributeError(err)
    }
  })
  .get("/profiles", async (c) => {
    return c.json({ items: await c.get("repo").listAttributeProfiles() })
  })
  .post("/profiles", async (c) => {
    const parsed = ProfileBody.safeParse(await readJsonBody(c))
    if (!parsed.success) throw new HTTPException(400, { message: "invalid body" })
    try {
      const profile = await c.get("repo").createAttributeProfile(parsed.data)
      return c.json({ profile }, 201)
    } catch (err) {
      mapAttributeError(err)
    }
  })
