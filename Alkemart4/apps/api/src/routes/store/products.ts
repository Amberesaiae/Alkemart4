import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import type { AppEnv } from "../../context"

export const products = new Hono<AppEnv>().get("/:id", async (c) => {
  const detail = await c.get("repo").getProduct(c.req.param("id"))
  if (!detail) throw new HTTPException(404, { message: "product not found" })
  return c.json(detail)
})
