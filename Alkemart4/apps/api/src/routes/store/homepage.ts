import { Hono } from "hono"
import type { AppEnv } from "../../context"

export const storeHomepage = new Hono<AppEnv>().get("/", async (c) => {
  const sections = await c.get("homepage").getPublished()
  c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  return c.json({ key: "homepage", sections })
})
