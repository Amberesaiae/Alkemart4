import { Router, type IRouter } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  fulfillmentsTable,
  ordersTable,
  orderItemsTable,
  productsTable,
  vendorsTable,
  FULFILLMENT_STATUS_TRANSITIONS,
  type FulfillmentStatus,
} from "@workspace/db";
import { vendorIdsFor } from "@workspace/abilities";
import {
  GetVendorShopResponse,
  ListVendorProductsResponse,
  CreateVendorProductBody,
  CreateVendorProductResponse,
  UpdateVendorProductParams,
  UpdateVendorProductBody,
  UpdateVendorProductResponse,
  DeleteVendorProductParams,
  UpdateVendorOrderFulfillmentParams,
  UpdateVendorOrderFulfillmentBody,
  UpdateVendorOrderFulfillmentResponse,
  GetVendorAnalyticsResponse,
} from "@workspace/api-zod";
import { getApprovedImageMap, getApprovedImageUrl } from "../lib/imageLookup";
import { requireAbility } from "../middlewares/auth-session";
import { slugify } from "../lib/slug";
import { domainEvents } from "../lib/events";

const router: IRouter = Router();

router.get("/vendor/shop", requireAbility("update", "Product"), async (req, res): Promise<void> => {
  const vendorIds = vendorIdsFor(req.user!.roles);
  if (vendorIds.length === 0) {
    res.status(404).json({ error: "No vendor shop for this user" });
    return;
  }

  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, vendorIds[0]));
  if (!vendor) {
    res.status(404).json({ error: "No vendor shop for this user" });
    return;
  }

  const [logoImageUrl, bannerImageUrl] = await Promise.all([
    getApprovedImageUrl("vendor_logo", vendor.id),
    getApprovedImageUrl("vendor_banner", vendor.id),
  ]);

  res.json(GetVendorShopResponse.parse({ ...vendor, logoImageUrl, bannerImageUrl }));
});

router.get("/vendor/products", requireAbility("update", "Product"), async (req, res): Promise<void> => {
  const vendorIds = vendorIdsFor(req.user!.roles);
  if (vendorIds.length === 0) {
    res.json(ListVendorProductsResponse.parse({ items: [], total: 0 }));
    return;
  }

  const items = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.vendorId, vendorIds))
    .orderBy(productsTable.id);

  const imageMap = await getApprovedImageMap("product", items.map((p) => p.id));
  const itemsWithImages = items.map((p) => ({ ...p, imageUrl: imageMap.get(p.id) ?? null }));

  res.json(ListVendorProductsResponse.parse({ items: itemsWithImages, total: itemsWithImages.length }));
});

router.post("/vendor/products", requireAbility("create", "Product"), async (req, res): Promise<void> => {
  const body = CreateVendorProductBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const vendorIds = vendorIdsFor(req.user!.roles);
  if (vendorIds.length === 0) {
    res.status(403).json({ error: "No vendor shop for this user" });
    return;
  }
  const vendorId = vendorIds[0]!;

  const baseSlug = slugify(body.data.title);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.slug, slug));
    if (!existing) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const [created] = await db
    .insert(productsTable)
    .values({
      vendorId,
      categoryId: body.data.categoryId,
      slug,
      title: body.data.title,
      brand: body.data.brand ?? null,
      description: body.data.description ?? null,
      pricePesewas: body.data.pricePesewas,
      compareAtPesewas: body.data.compareAtPesewas ?? null,
      stock: body.data.stock,
      tag: body.data.tag ?? null,
    })
    .returning();

  res.json(CreateVendorProductResponse.parse({ ...created, imageUrl: null }));
});

router.patch("/vendor/products/:id", requireAbility("update", "Product"), async (req, res): Promise<void> => {
  const params = UpdateVendorProductParams.safeParse(req.params);
  const body = UpdateVendorProductBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.error ?? body.error)?.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Row-level check: the coarse `requireAbility("update", "Product")` above only
  // confirms the user has SOME vendor role; verify against the actual product's
  // vendorId so a vendor can never edit another vendor's product. `Subjects` in
  // `@workspace/abilities` is a plain string tag (no per-subject field map), so
  // CASL's `subject()` instance helper can't type-check field conditions here —
  // do the ownership check directly against the resolved vendor ids instead.
  if (!vendorIdsFor(req.user!.roles).includes(product.vendorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db
    .update(productsTable)
    .set(body.data)
    .where(eq(productsTable.id, product.id))
    .returning();

  res.json(UpdateVendorProductResponse.parse(updated));
});

router.delete("/vendor/products/:id", requireAbility("delete", "Product"), async (req, res): Promise<void> => {
  const params = DeleteVendorProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (!vendorIdsFor(req.user!.roles).includes(product.vendorId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    await db.delete(productsTable).where(eq(productsTable.id, product.id));
  } catch (error) {
    // Products referenced by existing order line items can't be hard-deleted
    // (order history must keep pointing at a real row) — fall back to a soft
    // delete so historical orders stay intact while the product disappears
    // from the storefront and the vendor's active listings.
    const pgError = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    const isForeignKeyViolation = typeof pgError === "object" && pgError !== null && "code" in pgError && pgError.code === "23503";
    if (!isForeignKeyViolation) {
      throw error;
    }
    await db.update(productsTable).set({ isActive: false }).where(eq(productsTable.id, product.id));
  }
  res.status(204).end();
});

router.patch(
  "/vendor/orders/:orderId/fulfillment",
  requireAbility("update", "Fulfillment"),
  async (req, res): Promise<void> => {
    const params = UpdateVendorOrderFulfillmentParams.safeParse(req.params);
    const body = UpdateVendorOrderFulfillmentBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: (params.error ?? body.error)?.message });
      return;
    }

    const vendorIds = vendorIdsFor(req.user!.roles);
    if (vendorIds.length === 0) {
      res.status(404).json({ error: "Fulfillment not found" });
      return;
    }

    const [fulfillment] = await db
      .select()
      .from(fulfillmentsTable)
      .where(and(eq(fulfillmentsTable.orderId, params.data.orderId), inArray(fulfillmentsTable.vendorId, vendorIds)));
    if (!fulfillment) {
      res.status(404).json({ error: "Fulfillment not found" });
      return;
    }

    const nextStatus = body.data.status as FulfillmentStatus;
    const allowedNext = FULFILLMENT_STATUS_TRANSITIONS[fulfillment.status];
    if (!allowedNext.includes(nextStatus)) {
      res.status(400).json({
        error: `Cannot transition fulfillment from "${fulfillment.status}" to "${nextStatus}"`,
      });
      return;
    }

    const now = new Date();
    const timestampColumn =
      nextStatus === "packed" ? { packedAt: now } : nextStatus === "shipped" ? { shippedAt: now } : nextStatus === "delivered" ? { deliveredAt: now } : {};

    const [updated] = await db
      .update(fulfillmentsTable)
      .set({ status: nextStatus, ...timestampColumn })
      .where(eq(fulfillmentsTable.id, fulfillment.id))
      .returning();
    if (!updated) {
      throw new Error("Failed to update fulfillment");
    }

    const [order] = await db.select({ buyerUserId: ordersTable.buyerUserId }).from(ordersTable).where(eq(ordersTable.id, updated.orderId));

    domainEvents.emitEvent("fulfillment.status_changed", {
      fulfillmentId: updated.id,
      orderId: updated.orderId,
      vendorId: updated.vendorId,
      status: updated.status,
      previousStatus: fulfillment.status,
      buyerUserId: order?.buyerUserId,
    });

    res.json(UpdateVendorOrderFulfillmentResponse.parse(updated));
  },
);

const REVENUE_STATUSES = ["confirmed", "fulfilled"] as const;
const LOW_STOCK_THRESHOLD = 10;

router.get("/vendor/analytics", requireAbility("update", "Product"), async (req, res): Promise<void> => {
  const vendorIds = vendorIdsFor(req.user!.roles);
  if (vendorIds.length === 0) {
    res.json(
      GetVendorAnalyticsResponse.parse({
        revenueSeries: [],
        orderStatusBreakdown: [],
        topProducts: [],
        lowStockProducts: [],
      }),
    );
    return;
  }

  const [revenueSeries, orderStatusBreakdown, topProducts, lowStockProducts] = await Promise.all([
    db
      .select({
        date: sql<string>`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`,
        revenuePesewas: sql<number>`coalesce(sum(${orderItemsTable.subtotalPesewas}), 0)::int`,
        orderCount: sql<number>`count(distinct ${orderItemsTable.orderId})::int`,
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(and(inArray(orderItemsTable.vendorId, vendorIds), inArray(ordersTable.status, REVENUE_STATUSES)))
      .groupBy(sql`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${ordersTable.createdAt}, 'YYYY-MM-DD')`),
    db
      .select({ status: ordersTable.status, count: sql<number>`count(distinct ${ordersTable.id})::int` })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(inArray(orderItemsTable.vendorId, vendorIds))
      .groupBy(ordersTable.status),
    db
      .select({
        productId: orderItemsTable.productId,
        title: orderItemsTable.titleSnapshot,
        unitsSold: sql<number>`coalesce(sum(${orderItemsTable.qty}), 0)::int`,
        revenuePesewas: sql<number>`coalesce(sum(${orderItemsTable.subtotalPesewas}), 0)::int`,
      })
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(and(inArray(orderItemsTable.vendorId, vendorIds), inArray(ordersTable.status, REVENUE_STATUSES)))
      .groupBy(orderItemsTable.productId, orderItemsTable.titleSnapshot)
      .orderBy(sql`coalesce(sum(${orderItemsTable.subtotalPesewas}), 0) desc`)
      .limit(10),
    db
      .select({ productId: productsTable.id, title: productsTable.title, stock: productsTable.stock })
      .from(productsTable)
      .where(and(inArray(productsTable.vendorId, vendorIds), eq(productsTable.isActive, true)))
      .orderBy(productsTable.stock)
      .limit(20)
      .then((rows) => rows.filter((r) => r.stock <= LOW_STOCK_THRESHOLD)),
  ]);

  res.json(GetVendorAnalyticsResponse.parse({ revenueSeries, orderStatusBreakdown, topProducts, lowStockProducts }));
});

export default router;
