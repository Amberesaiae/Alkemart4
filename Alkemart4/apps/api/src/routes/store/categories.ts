import { Hono } from "hono"
import type { AppEnv } from "../../context"

export const categories = new Hono<AppEnv>().get("/", async (c) => {
  const tree = await c.get("repo").listCategories()
  return c.json({ categories: tree })
})
