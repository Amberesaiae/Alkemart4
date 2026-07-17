import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { and, desc, eq, isNull } from "drizzle-orm";
import sharp from "sharp";
import { db, imagesTable, imageUploadIntentsTable, productsTable, vendorsTable, homepageSectionsTable, type ImageTargetType } from "@workspace/db";
import { isAdmin, vendorIdsFor } from "@workspace/abilities";
import {
  RequestImageUploadUrlBody,
  RequestImageUploadUrlResponse,
  RegisterImageBody,
  ListMyImagesResponse,
  ListAdminImagesQueryParams,
  ListAdminImagesResponse,
  ApproveAdminImageParams,
  ApproveAdminImageResponse,
  RejectAdminImageParams,
  RejectAdminImageBody,
  RejectAdminImageResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { toImageUrl } from "../lib/imageLookup";
import { requireAbility } from "../middlewares/auth-session";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Technical quality gates — server-side authoritative, enforced against the
// real downloaded bytes (never trust client-reported width/height/size).
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MIN_WIDTH = 600;
const MIN_HEIGHT = 600;

function withImageUrl<T extends { objectPath: string }>(image: T): T & { imageUrl: string } {
  return { ...image, imageUrl: toImageUrl(image.objectPath) };
}

/**
 * Resolves the vendorId that an image upload for a given target should be
 * scoped to, and enforces row-level ownership for non-admin callers (mirrors
 * the pattern in routes/vendor.ts — the coarse CASL check only proves "some
 * vendor role"; this proves "this specific target belongs to that vendor").
 */
async function resolveTargetVendorId(
  targetType: ImageTargetType,
  targetId: number | null | undefined,
  callerVendorIds: number[],
  callerIsAdmin: boolean,
): Promise<{ ok: true; vendorId: number | null } | { ok: false; status: number; error: string }> {
  if (targetType === "homepage_section") {
    if (!callerIsAdmin) {
      return { ok: false, status: 403, error: "Only admins can upload homepage images" };
    }
    if (targetId == null) {
      return { ok: false, status: 400, error: "targetId is required for homepage_section images" };
    }
    const [section] = await db.select().from(homepageSectionsTable).where(eq(homepageSectionsTable.id, targetId));
    if (!section) {
      return { ok: false, status: 404, error: "Homepage section not found" };
    }
    return { ok: true, vendorId: null };
  }

  if (targetType === "product") {
    if (targetId == null) {
      return { ok: false, status: 400, error: "targetId is required for product images" };
    }
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, targetId));
    if (!product) {
      return { ok: false, status: 404, error: "Product not found" };
    }
    if (!callerIsAdmin && !callerVendorIds.includes(product.vendorId)) {
      return { ok: false, status: 403, error: "Forbidden" };
    }
    return { ok: true, vendorId: product.vendorId };
  }

  // vendor_logo / vendor_banner
  if (targetId == null) {
    return { ok: false, status: 400, error: "targetId (vendorId) is required for vendor images" };
  }
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, targetId));
  if (!vendor) {
    return { ok: false, status: 404, error: "Vendor not found" };
  }
  if (!callerIsAdmin && !callerVendorIds.includes(vendor.id)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, vendorId: vendor.id };
}

router.post(
  "/images/uploads/request-url",
  requireAbility("create", "Image"),
  async (req: Request, res: Response) => {
    const parsed = RequestImageUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }
    const { name, size, contentType } = parsed.data;

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      res.status(400).json({ error: "Only JPEG, PNG or WebP images are allowed" });
      return;
    }
    if (size > MAX_SIZE_BYTES) {
      res.status(400).json({ error: `File exceeds the ${MAX_SIZE_BYTES / (1024 * 1024)}MB limit` });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      // Record that this exact objectPath was issued to this user — registration
      // later must prove the path it's processing came from here, not an
      // arbitrary client-supplied string.
      await db.insert(imageUploadIntentsTable).values({ userId: req.user!.id, objectPath });
      res.json(RequestImageUploadUrlResponse.parse({ uploadURL, objectPath, metadata: { name, size, contentType } }));
    } catch (error) {
      req.log.error({ err: error }, "Error generating image upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

router.post("/images", requireAbility("create", "Image"), async (req: Request, res: Response): Promise<void> => {
  const body = RegisterImageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const { objectPath, targetType, targetId } = body.data;

  const callerVendorIds = vendorIdsFor(req.user!.roles);
  const callerIsAdmin = isAdmin(req.user!.roles);

  // Never trust a client-supplied objectPath on its own — it's about to be
  // downloaded, inspected, and possibly deleted. Only accept paths that were
  // actually issued to this user via /images/uploads/request-url, and only
  // once per issued path (prevents replay/reuse and cross-object tampering).
  const [intent] = await db
    .update(imageUploadIntentsTable)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(imageUploadIntentsTable.objectPath, objectPath),
        eq(imageUploadIntentsTable.userId, req.user!.id),
        isNull(imageUploadIntentsTable.consumedAt),
      ),
    )
    .returning();
  if (!intent) {
    res.status(400).json({ error: "Invalid or already-used upload path" });
    return;
  }

  const resolved = await resolveTargetVendorId(targetType, targetId ?? null, callerVendorIds, callerIsAdmin);
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }

  let objectFile;
  try {
    objectFile = await objectStorageService.getObjectEntityFile(objectPath);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "Uploaded object not found — upload the file before registering it" });
      return;
    }
    throw error;
  }

  const [buffer] = await objectFile.download();

  let rejectionReason: string | null = null;
  let metadata: { width?: number; height?: number; format?: string } = {};
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    rejectionReason = "Could not read image file — it may be corrupted or an unsupported format";
  }

  const detectedContentType = metadata.format ? `image/${metadata.format === "jpg" ? "jpeg" : metadata.format}` : null;

  if (!rejectionReason && (!detectedContentType || !ALLOWED_CONTENT_TYPES.has(detectedContentType))) {
    rejectionReason = "Only JPEG, PNG or WebP images are allowed";
  }
  if (!rejectionReason && buffer.length > MAX_SIZE_BYTES) {
    rejectionReason = `File exceeds the ${MAX_SIZE_BYTES / (1024 * 1024)}MB limit`;
  }
  if (!rejectionReason && (!metadata.width || !metadata.height || metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT)) {
    rejectionReason = `Image must be at least ${MIN_WIDTH}x${MIN_HEIGHT}px`;
  }

  const status = rejectionReason ? "rejected" : "pending";

  if (rejectionReason) {
    // Technical rejection — clean up the orphaned upload; it will never be served.
    await objectFile.delete().catch((err) => req.log.warn({ err }, "Failed to delete rejected image object"));
  }

  const [created] = await db
    .insert(imagesTable)
    .values({
      ownerUserId: req.user!.id,
      vendorId: resolved.vendorId,
      targetType,
      targetId: targetId ?? null,
      objectPath,
      status,
      rejectionReason,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      sizeBytes: buffer.length,
      contentType: detectedContentType,
    })
    .returning();

  res.json(withImageUrl(created));
});

router.get("/images/mine", requireAbility("read", "Image"), async (req: Request, res: Response): Promise<void> => {
  const items = await db
    .select()
    .from(imagesTable)
    .where(eq(imagesTable.ownerUserId, req.user!.id))
    .orderBy(desc(imagesTable.createdAt));

  res.json(ListMyImagesResponse.parse({ items: items.map(withImageUrl), total: items.length }));
});

router.get("/admin/images", requireAbility("manage", "Image"), async (req: Request, res: Response): Promise<void> => {
  const query = ListAdminImagesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = query.data.status ? [eq(imagesTable.status, query.data.status)] : [];
  const items = await db
    .select()
    .from(imagesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(imagesTable.createdAt));

  res.json(ListAdminImagesResponse.parse({ items: items.map(withImageUrl), total: items.length }));
});

router.post(
  "/admin/images/:id/approve",
  requireAbility("manage", "Image"),
  async (req: Request, res: Response): Promise<void> => {
    const params = ApproveAdminImageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [updated] = await db
      .update(imagesTable)
      .set({ status: "approved", rejectionReason: null, reviewedByUserId: req.user!.id, reviewedAt: new Date() })
      .where(eq(imagesTable.id, params.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    res.json(ApproveAdminImageResponse.parse(withImageUrl(updated)));
  },
);

router.post(
  "/admin/images/:id/reject",
  requireAbility("manage", "Image"),
  async (req: Request, res: Response): Promise<void> => {
    const params = ApproveAdminImageParams.safeParse(req.params);
    const body = RejectAdminImageBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: (params.error ?? body.error)?.message });
      return;
    }

    const [updated] = await db
      .update(imagesTable)
      .set({
        status: "rejected",
        rejectionReason: body.data.reason,
        reviewedByUserId: req.user!.id,
        reviewedAt: new Date(),
      })
      .where(eq(imagesTable.id, params.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    res.json(RejectAdminImageResponse.parse(withImageUrl(updated)));
  },
);

/**
 * Serves uploaded image bytes. Approved images are public (they're rendered
 * on public storefront pages); pending/rejected images are only visible to
 * the uploader's vendor or an admin, since they may contain rejected or
 * unmoderated content.
 */
router.get("/images/objects/*path", async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const [record] = await db.select().from(imagesTable).where(eq(imagesTable.objectPath, objectPath));
    if (!record) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    if (record.status !== "approved") {
      if (!req.user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const canView = isAdmin(req.user.roles) || (record.vendorId != null && vendorIdsFor(req.user.roles).includes(record.vendorId));
      if (!canView) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving image object");
    res.status(500).json({ error: "Failed to serve image" });
  }
});

export default router;
