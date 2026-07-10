import { Router, type IRouter } from "express";
import { eq, desc, asc } from "drizzle-orm";
import { db, conversationsTable, messagesTable, usersTable } from "@workspace/db";
import {
  ListMyConversationsResponse,
  CreateMyConversationBody,
  CreateMyConversationResponse,
  ListAdminConversationsResponse,
  CreateAdminConversationBody,
  CreateAdminConversationResponse,
  ListConversationMessagesParams,
  ListConversationMessagesResponse,
  CreateConversationMessageParams,
  CreateConversationMessageBody,
  CreateConversationMessageResponse,
} from "@workspace/api-zod";
import { requireAbility, requireAuth } from "../middlewares/auth-session";

const router: IRouter = Router();

/** Can the caller read/post in this conversation? Own conversation, or admin/support_agent. */
function canAccessConversation(req: import("express").Request, conversation: { userId: number }): boolean {
  if (conversation.userId === req.user!.id) return true;
  return req.ability.can("manage", "AdminPanel");
}

router.get("/conversations/me", requireAuth, async (req, res): Promise<void> => {
  const items = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, req.user!.id))
    .orderBy(desc(conversationsTable.lastMessageAt));
  res.json(ListMyConversationsResponse.parse(items));
});

router.post("/conversations/me", requireAuth, async (req, res): Promise<void> => {
  const body = CreateMyConversationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, req.user!.id))
    .orderBy(desc(conversationsTable.lastMessageAt));

  const conversation =
    existing && existing.status === "open"
      ? existing
      : (
          await db
            .insert(conversationsTable)
            .values({ userId: req.user!.id, subject: body.data.subject, status: "open" })
            .returning()
        )[0];

  await db.insert(messagesTable).values({ conversationId: conversation.id, senderId: req.user!.id, body: body.data.message });
  await db.update(conversationsTable).set({ lastMessageAt: new Date() }).where(eq(conversationsTable.id, conversation.id));

  res.json(CreateMyConversationResponse.parse(conversation));
});

router.get("/admin/conversations", requireAbility("manage", "AdminPanel"), async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: conversationsTable.id,
      userId: conversationsTable.userId,
      subject: conversationsTable.subject,
      status: conversationsTable.status,
      createdAt: conversationsTable.createdAt,
      lastMessageAt: conversationsTable.lastMessageAt,
      customerEmail: usersTable.email,
      customerFirstName: usersTable.firstName,
      customerLastName: usersTable.lastName,
    })
    .from(conversationsTable)
    .innerJoin(usersTable, eq(usersTable.id, conversationsTable.userId))
    .orderBy(desc(conversationsTable.lastMessageAt));

  const items = rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    subject: row.subject,
    status: row.status,
    createdAt: row.createdAt,
    lastMessageAt: row.lastMessageAt,
    customerEmail: row.customerEmail,
    customerName: [row.customerFirstName, row.customerLastName].filter(Boolean).join(" ") || null,
  }));

  res.json(ListAdminConversationsResponse.parse(items));
});

router.post("/admin/conversations", requireAbility("manage", "AdminPanel"), async (req, res): Promise<void> => {
  const body = CreateAdminConversationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, body.data.userId));
  if (!targetUser) {
    res.status(404).json({ error: "Target user not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, targetUser.id))
    .orderBy(desc(conversationsTable.lastMessageAt));

  const conversation =
    existing && existing.status === "open"
      ? existing
      : (
          await db
            .insert(conversationsTable)
            .values({ userId: targetUser.id, subject: body.data.subject, status: "open" })
            .returning()
        )[0];

  res.json(
    CreateAdminConversationResponse.parse({
      ...conversation,
      customerEmail: targetUser.email,
      customerName: [targetUser.firstName, targetUser.lastName].filter(Boolean).join(" ") || null,
    }),
  );
});

router.get("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const params = ListConversationMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, params.data.id));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  if (!canAccessConversation(req, conversation)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const items = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversation.id))
    .orderBy(asc(messagesTable.createdAt));

  res.json(ListConversationMessagesResponse.parse(items));
});

router.post("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const params = CreateConversationMessageParams.safeParse(req.params);
  const body = CreateConversationMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: (params.error ?? body.error)?.message });
    return;
  }

  const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, params.data.id));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  if (!canAccessConversation(req, conversation)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({ conversationId: conversation.id, senderId: req.user!.id, body: body.data.body })
    .returning();
  await db.update(conversationsTable).set({ lastMessageAt: new Date() }).where(eq(conversationsTable.id, conversation.id));

  res.json(CreateConversationMessageResponse.parse(message));
});

export default router;
