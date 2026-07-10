import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  categoriesTable,
  conversationsTable,
  messagesTable,
  productsTable,
  sessionsTable,
  userRolesTable,
  usersTable,
  vendorsTable,
} from "@workspace/db";
import app from "../app";
import { hashPassword, createSession } from "../lib/auth";

/**
 * Regression coverage for the vendor add-product sheet and vendor messaging
 * flows. Each test exercises the real HTTP layer so that a future API change
 * (renaming a field, tightening a Zod schema, changing an auth guard) will
 * immediately surface as a failure here rather than silently reaching
 * production.
 *
 * Test 1 – Add Product:
 *   POST /api/vendor/products with title/price/category/stock creates the
 *   product and the subsequent GET returns it with the exact fields the
 *   products table reads (including stock ≤ 10, which drives the "Low stock"
 *   badge in the frontend).
 *
 * Test 2 – Messaging:
 *   GET /api/conversations/me renders the conversation list (or returns an
 *   empty array). POST /api/conversations/:id/messages creates a reply and
 *   GET /api/conversations/:id/messages immediately reflects it.
 */
describe("vendor add-product flow", () => {
  const suffix = randomUUID().slice(0, 8);

  let categoryId: number;
  let vendorId: number;
  let vendorUserId: number;
  let vendorSessionToken: string;
  const createdProductIds: number[] = [];

  beforeAll(async () => {
    // ── vendor & category ────────────────────────────────────────────────
    const [vendor] = await db
      .insert(vendorsTable)
      .values({ slug: `vp-create-vendor-${suffix}`, name: "VP Create Vendor" })
      .returning();
    vendorId = vendor!.id;

    const [category] = await db
      .insert(categoriesTable)
      .values({ slug: `vp-create-cat-${suffix}`, name: "VP Create Category" })
      .returning();
    categoryId = category!.id;

    // ── vendor user ──────────────────────────────────────────────────────
    const [vendorUser] = await db
      .insert(usersTable)
      .values({
        email: `vp-create-vendor-${suffix}@example.com`,
        passwordHash: await hashPassword("Password123!"),
        firstName: "VendorCreate",
      })
      .returning();
    vendorUserId = vendorUser!.id;

    await db.insert(userRolesTable).values({ userId: vendorUserId, role: "vendor_owner", vendorId });

    const { token } = await createSession(vendorUserId);
    vendorSessionToken = token;
  });

  afterAll(async () => {
    // Delete products before category/vendor (FK constraints)
    if (createdProductIds.length > 0) {
      await db.delete(productsTable).where(inArray(productsTable.id, createdProductIds));
    }
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, vendorUserId));
    await db.delete(userRolesTable).where(eq(userRolesTable.userId, vendorUserId));
    await db.delete(usersTable).where(eq(usersTable.id, vendorUserId));
    // Category and vendor can only be removed after products are gone
    await db.delete(categoriesTable).where(eq(categoriesTable.id, categoryId));
    await db.delete(vendorsTable).where(eq(vendorsTable.id, vendorId));
  });

  it("rejects product creation when not authenticated", async () => {
    const res = await request(app).post("/api/vendor/products").send({
      title: "Unauthenticated Product",
      pricePesewas: 500,
      categoryId,
      stock: 5,
    });
    expect(res.status).toBe(401);
  });

  it("creates a product and the GET list reflects it with the correct fields", async () => {
    const res = await request(app)
      .post("/api/vendor/products")
      .set("Cookie", [`session_token=${vendorSessionToken}`])
      .send({
        title: `Test Product ${suffix}`,
        pricePesewas: 1500,
        categoryId,
        stock: 8, // ≤ 10 — frontend renders "Low stock" badge
        tag: "new",
      });

    expect(res.status).toBe(200);
    const product = res.body as {
      id: number;
      title: string;
      pricePesewas: number;
      stock: number;
      categoryId: number;
      isActive: boolean;
      tag: string | null;
    };
    createdProductIds.push(product.id);

    expect(product.title).toBe(`Test Product ${suffix}`);
    expect(product.pricePesewas).toBe(1500);
    expect(product.categoryId).toBe(categoryId);
    expect(product.isActive).toBe(true);

    // stock ≤ 10 is what drives the frontend "Low stock" badge
    expect(product.stock).toBe(8);
    expect(product.stock).toBeLessThanOrEqual(10);
  });

  it("returns the created product in the vendor product list", async () => {
    const listRes = await request(app)
      .get("/api/vendor/products")
      .set("Cookie", [`session_token=${vendorSessionToken}`]);

    expect(listRes.status).toBe(200);

    const { items } = listRes.body as { items: Array<{ id: number; title: string; stock: number }> };
    const created = items.find((p) => createdProductIds.includes(p.id));

    expect(created).toBeDefined();
    expect(created!.title).toBe(`Test Product ${suffix}`);
    expect(created!.stock).toBe(8);
  });

  it("rejects product creation when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/vendor/products")
      .set("Cookie", [`session_token=${vendorSessionToken}`])
      .send({
        // title intentionally omitted
        pricePesewas: 200,
        categoryId,
      });

    expect(res.status).toBe(400);
  });
});

describe("vendor messaging flow", () => {
  const suffix = randomUUID().slice(0, 8);

  let buyerUserId: number;
  let buyerSessionToken: string;
  let conversationId: number;
  const messageIds: number[] = [];

  beforeAll(async () => {
    // Use a buyer user — conversations/me is available to all authenticated
    // users and the vendor messages page reads the same endpoint for the
    // vendor's own conversations.
    const [buyer] = await db
      .insert(usersTable)
      .values({
        email: `msg-flow-buyer-${suffix}@example.com`,
        passwordHash: await hashPassword("Password123!"),
        firstName: "MsgFlowBuyer",
      })
      .returning();
    buyerUserId = buyer!.id;

    await db.insert(userRolesTable).values({ userId: buyerUserId, role: "buyer", vendorId: null });

    const { token } = await createSession(buyerUserId);
    buyerSessionToken = token;
  });

  afterAll(async () => {
    if (messageIds.length > 0) {
      await db.delete(messagesTable).where(inArray(messagesTable.id, messageIds));
    }
    if (conversationId) {
      await db.delete(conversationsTable).where(eq(conversationsTable.id, conversationId));
    }
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, buyerUserId));
    await db.delete(userRolesTable).where(eq(userRolesTable.userId, buyerUserId));
    await db.delete(usersTable).where(eq(usersTable.id, buyerUserId));
  });

  it("returns an empty conversation list before any conversations exist", async () => {
    const res = await request(app)
      .get("/api/conversations/me")
      .set("Cookie", [`session_token=${buyerSessionToken}`]);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Brand-new user — no conversations yet (mirrors the empty-state the
    // vendor messages page renders when conversations.length === 0)
    expect(res.body).toHaveLength(0);
  });

  it("rejects GET /conversations/me when not authenticated", async () => {
    const res = await request(app).get("/api/conversations/me");
    expect(res.status).toBe(401);
  });

  it("creates a new conversation thread", async () => {
    const res = await request(app)
      .post("/api/conversations/me")
      .set("Cookie", [`session_token=${buyerSessionToken}`])
      .send({ subject: `Support thread ${suffix}`, message: "Hello, I need help." });

    expect(res.status).toBe(200);
    const conv = res.body as { id: number; userId: number; subject: string; status: string };
    conversationId = conv.id;

    expect(conv.userId).toBe(buyerUserId);
    expect(conv.subject).toBe(`Support thread ${suffix}`);
    expect(conv.status).toBe("open");
  });

  it("conversation list now returns the thread", async () => {
    const res = await request(app)
      .get("/api/conversations/me")
      .set("Cookie", [`session_token=${buyerSessionToken}`]);

    expect(res.status).toBe(200);
    const list = res.body as Array<{ id: number; subject: string }>;
    const found = list.find((c) => c.id === conversationId);

    expect(found).toBeDefined();
    expect(found!.subject).toBe(`Support thread ${suffix}`);
  });

  it("fetches the initial message in the thread", async () => {
    const res = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set("Cookie", [`session_token=${buyerSessionToken}`]);

    expect(res.status).toBe(200);
    const msgs = res.body as Array<{ id: number; senderId: number; body: string }>;

    // The opening message sent with POST /conversations/me
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0]!.body).toBe("Hello, I need help.");
    expect(msgs[0]!.senderId).toBe(buyerUserId);
    messageIds.push(...msgs.map((m) => m.id));
  });

  it("sending a reply adds a new message to the thread", async () => {
    const replyBody = `Reply from buyer ${suffix}`;

    const sendRes = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set("Cookie", [`session_token=${buyerSessionToken}`])
      .send({ body: replyBody });

    expect(sendRes.status).toBe(200);
    const sent = sendRes.body as { id: number; conversationId: number; senderId: number; body: string };
    messageIds.push(sent.id);

    expect(sent.body).toBe(replyBody);
    expect(sent.senderId).toBe(buyerUserId);
    expect(sent.conversationId).toBe(conversationId);

    // Immediately verify the thread reflects the new message
    const threadRes = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set("Cookie", [`session_token=${buyerSessionToken}`]);

    expect(threadRes.status).toBe(200);
    const thread = threadRes.body as Array<{ id: number; body: string }>;
    const reply = thread.find((m) => m.id === sent.id);

    expect(reply).toBeDefined();
    expect(reply!.body).toBe(replyBody);
  });

  it("blocks a third user from reading another user's thread", async () => {
    // Spin up a second buyer with no relation to conversationId
    const [other] = await db
      .insert(usersTable)
      .values({
        email: `msg-flow-other-${suffix}@example.com`,
        passwordHash: await hashPassword("Password123!"),
        firstName: "OtherBuyer",
      })
      .returning();

    await db.insert(userRolesTable).values({ userId: other!.id, role: "buyer", vendorId: null });
    const { token: otherToken } = await createSession(other!.id);

    const res = await request(app)
      .get(`/api/conversations/${conversationId}/messages`)
      .set("Cookie", [`session_token=${otherToken}`]);

    // Clean up the second user before asserting so we don't leave dangling rows
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, other!.id));
    await db.delete(userRolesTable).where(eq(userRolesTable.userId, other!.id));
    await db.delete(usersTable).where(eq(usersTable.id, other!.id));

    expect(res.status).toBe(403);
  });
});
