import { Router, type IRouter } from "express";
import { and, eq, ilike, or } from "drizzle-orm";
import { db, categoriesTable, productsTable, vendorsTable } from "@workspace/db";
import {
  ListCategoriesResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  GetProductParams,
  GetProductResponse,
  GetVendorParams,
  GetVendorResponse,
} from "@workspace/api-zod";
import { getApprovedImageMap, getApprovedImageUrl } from "../lib/imageLookup";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.sortOrder);
  res.json(ListCategoriesResponse.parse(categories));
});

router.get("/products", async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { categorySlug, tag, search, vendorSlug, limit, offset } = params.data;

  const conditions = [eq(productsTable.isActive, true)];

  if (categorySlug) {
    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, categorySlug));
    if (!category) {
      res.json(ListProductsResponse.parse({ items: [], total: 0 }));
      return;
    }
    conditions.push(eq(productsTable.categoryId, category.id));
  }

  if (vendorSlug) {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.slug, vendorSlug));
    if (!vendor) {
      res.json(ListProductsResponse.parse({ items: [], total: 0 }));
      return;
    }
    conditions.push(eq(productsTable.vendorId, vendor.id));
  }

  if (tag) {
    conditions.push(eq(productsTable.tag, tag));
  }

  if (search) {
    conditions.push(
      or(ilike(productsTable.title, `%${search}%`), ilike(productsTable.brand, `%${search}%`))!,
    );
  }

  const where = and(...conditions);

  const items = await db
    .select()
    .from(productsTable)
    .where(where)
    .orderBy(productsTable.id)
    .limit(limit)
    .offset(offset);

  const all = await db.select({ id: productsTable.id }).from(productsTable).where(where);

  const imageMap = await getApprovedImageMap("product", items.map((p) => p.id));
  const itemsWithImages = items.map((p) => ({ ...p, imageUrl: imageMap.get(p.id) ?? null }));

  res.json(ListProductsResponse.parse({ items: itemsWithImages, total: all.length }));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, product.vendorId));
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  const [imageUrl, vendorLogoUrl, vendorBannerUrl] = await Promise.all([
    getApprovedImageUrl("product", product.id),
    getApprovedImageUrl("vendor_logo", vendor.id),
    getApprovedImageUrl("vendor_banner", vendor.id),
  ]);

  res.json(
    GetProductResponse.parse({
      ...product,
      imageUrl,
      vendor: { ...vendor, logoImageUrl: vendorLogoUrl, bannerImageUrl: vendorBannerUrl },
    }),
  );
});

router.get("/vendors/:slug", async (req, res): Promise<void> => {
  const params = GetVendorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.slug, params.data.slug));
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }

  const [logoImageUrl, bannerImageUrl] = await Promise.all([
    getApprovedImageUrl("vendor_logo", vendor.id),
    getApprovedImageUrl("vendor_banner", vendor.id),
  ]);

  res.json(GetVendorResponse.parse({ ...vendor, logoImageUrl, bannerImageUrl }));
});

export default router;
