import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminConversations,
  useListConversationMessages,
  useCreateConversationMessage,
  getListConversationMessagesQueryKey,
  getListAdminConversationsQueryKey,
} from "@workspace/api-client-react";
import type { ConversationSummary } from "@workspace/api-client-react";
import { AdminShell } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { requireAdminAccessBeforeLoad } from "@/lib/auth";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_shop/admin/inbox")({
  beforeLoad: requireAdminAccessBeforeLoad,
  validateSearch: z.object({ conversationId: z.number().optional() }),
  head: () => ({ meta: [{ title: "Inbox — Admin panel" }] }),
  component: AdminInboxPage,
});

function ConversationListItem({ conversation, active, onClick }: { conversation: ConversationSummary; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md border border-transparent p-3 text-left transition-colors hover:bg-secondary",
        active && "border-primary bg-secondary",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold">{conversation.customerName ?? conversation.customerEmail}</span>
        <Badge variant={conversation.status === "open" ? "secondary" : "outline"} className="shrink-0">
          {conversation.status}
        </Badge>
      </div>
      <div className="truncate text-sm text-muted-foreground">{conversation.subject}</div>
    </button>
  );
}

function ConversationThread({ conversationId }: { conversationId: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useListConversationMessages(conversationId, {
    query: { queryKey: getListConversationMessagesQueryKey(conversationId), refetchInterval: 4000 },
  });

  const sendMessage = useCreateConversationMessage({
    mutation: {
      onSuccess: () => {
        setDraft("");
        queryClient.invalidateQueries({ queryKey: getListConversationMessagesQueryKey(conversationId) });
      },
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    sendMessage.mutate({ id: conversationId, data: { body } });
  }

  return (
    <div className="flex h-[560px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {(messages ?? []).map((message) => {
          const isMine = message.senderId === user?.id;
          return (
            <div key={message.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-md px-4 py-2 text-sm",
                  isMine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
                )}
              >
                {message.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-end gap-2 border-t border-border p-3">
        <Textarea
          value={draft}
          aria-label="Type a reply…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={2}
          placeholder="Type a reply…"
          className="resize-none"
        />
        <Button onClick={handleSend} disabled={sendMessage.isPending || !draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}

function AdminInboxPage() {
  const search = Route.useSearch();
  const { data, isLoading } = useListAdminConversations({
    query: { queryKey: getListAdminConversationsQueryKey(), refetchInterval: 8000 },
  });
  const conversations = data ?? [];
  const [selectedId, setSelectedId] = useState<number | undefined>(search.conversationId);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? conversations[0],
    [conversations, selectedId],
  );

  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  return (
    <AdminShell title="Inbox" description="Message buyers and vendors directly. New messages poll automatically.">
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <div className="max-h-[560px] space-y-2 overflow-y-auto rounded-md border border-border p-3">
          {isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Loading conversations…</p>
          ) : conversations.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <ConversationListItem key={c.id} conversation={c} active={c.id === selected?.id} onClick={() => setSelectedId(c.id)} />
            ))
          )}
        </div>
        <div className="rounded-md border border-border">
          {selected ? (
            <ConversationThread key={selected.id} conversationId={selected.id} />
          ) : (
            <div className="flex h-[560px] items-center justify-center text-sm text-muted-foreground">
              Select a conversation to view messages.
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
