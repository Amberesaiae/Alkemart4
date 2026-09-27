import { Hono } from "hono"
import type { AppEnv } from "../../context"
import { checkPreviewToken } from "../../lib/preview-token"

export const storeHomepage = new Hono<AppEnv>().get("/", async (c) => {
  // An admin preview link (signed, 30 min) shows the unpublished draft.
  const preview = c.req.query("preview")
  if (preview && (await checkPreviewToken(c.get("jwtSecret"), "homepage-draft", preview))) {
    const draft = await c.get("homepage").getEditor()
    c.header("Cache-Control", "private, no-store")
    return c.json({ key: "homepage", sections: draft.sections, preview: true })
  }
  const sections = await c.get("homepage").getPublished()
  c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  return c.json({ key: "homepage", sections })
})
