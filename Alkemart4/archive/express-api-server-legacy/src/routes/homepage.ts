import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, homepageSectionsTable } from "@workspace/db";
import {
  ListHomepageSectionsResponse,
  ListAdminHomepageSectionsResponse,
  UpdateAdminHomepageSectionsBody,
  UpdateAdminHomepageSectionsResponse,
} from "@workspace/api-zod";
import { getApprovedImageMap } from "../lib/imageLookup";
import { requireAbility } from "../middlewares/auth-session";

const router: IRouter = Router();

async function withSectionImages<T extends { id: number }>(sections: T[]): Promise<(T & { imageUrl: string | null })[]> {
  const imageMap = await getApprovedImageMap("homepage_section", sections.map((s) => s.id));
  return sections.map((s) => ({ ...s, imageUrl: imageMap.get(s.id) ?? null }));
}

router.get("/homepage/sections", async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(homepageSectionsTable)
    .where(eq(homepageSectionsTable.enabled, true))
    .orderBy(homepageSectionsTable.sortOrder);

  const itemsWithImages = await withSectionImages(items);
  res.json(ListHomepageSectionsResponse.parse({ items: itemsWithImages, total: itemsWithImages.length }));
});

router.get(
  "/admin/homepage/sections",
  requireAbility("manage", "HomepageConfig"),
  async (_req, res): Promise<void> => {
    const items = await db.select().from(homepageSectionsTable).orderBy(homepageSectionsTable.sortOrder);
    const itemsWithImages = await withSectionImages(items);
    res.json(ListAdminHomepageSectionsResponse.parse({ items: itemsWithImages, total: itemsWithImages.length }));
  },
);

router.patch(
  "/admin/homepage/sections",
  requireAbility("manage", "HomepageConfig"),
  async (req, res): Promise<void> => {
    const body = UpdateAdminHomepageSectionsBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    for (const section of body.data.sections) {
      const { id, ...rest } = section;
      if (Object.keys(rest).length === 0) continue;
      await db.update(homepageSectionsTable).set(rest).where(eq(homepageSectionsTable.id, id));
    }

    const items = await db.select().from(homepageSectionsTable).orderBy(homepageSectionsTable.sortOrder);
    res.json(UpdateAdminHomepageSectionsResponse.parse({ items, total: items.length }));
  },
);

export default router;
