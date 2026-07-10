import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMyConversations,
  useListConversationMessages,
  useCreateConversationMessage,
  getListConversationMessagesQueryKey,
  getListMyConversationsQueryKey,
} from "@workspace/api-client-react";
import type { Conversation } from "@workspace/api-client-react";
import { VendorShell } from "@/components/vendor/vendor-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { requireVendorAccessBeforeLoad, useAuth } from "@/lib/auth";
import { VENDOR_MESSAGES_LAST_SEEN_KEY, markMessagesAsSeen } from "@/lib/vendor-messages-seen";

export const Route = createFileRoute("/_shop/vendor/messages")({
  beforeLoad: requireVendorAccessBeforeLoad,
  head: () => ({ meta: [{ title: "Messages — Vendor dashboard — alkemart Ghana" }] }),
  component: VendorMessagesPage,
});

function ConversationListItem({
  conversation,
  active,
  unread,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  unread: boolean;
  onClick: () => void;
}) {
  const date = new Date(conversation.lastMessageAt);
  const timeLabel = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

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
        <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
          {conversation.subject}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {unread && <span className="h-2 w-2 rounded-full bg-primary" />}
          <span className="text-[11px] text-muted-foreground">{timeLabel}</span>
        </div>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <Badge
          variant={conversation.status === "open" ? "secondary" : "outline"}
          className="text-[10px]"
        >
          {conversation.status}
        </Badge>
      </div>
    </button>
  );
}

function ConversationThread({ conversationId }: { conversationId: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useListConversationMessages(conversationId, {
    query: {
      queryKey: getListConversationMessagesQueryKey(conversationId),
      refetchInterval: 5000,
    },
  });

  const sendMessage = useCreateConversationMessage({
    mutation: {
      onSuccess: () => {
        setDraft("");
        void queryClient.invalidateQueries({ queryKey: getListConversationMessagesQueryKey(conversationId) });
        void queryClient.invalidateQueries({ queryKey: getListMyConversationsQueryKey() });
        markMessagesAsSeen();
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
        {(messages ?? []).length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">No messages yet.</p>
        )}
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
          placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
          className="resize-none"
        />
        <Button onClick={handleSend} disabled={sendMessage.isPending || !draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}

function VendorMessagesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListMyConversations({
    query: {
      queryKey: getListMyConversationsQueryKey(),
      refetchInterval: 8000,
    },
  });
  const conversations = useMemo(() => data ?? [], [data]);
  const [selectedId, setSelectedId] = useState<number | undefined>();

  // Mark seen on mount — clears the sidebar unread badge
  useEffect(() => {
    markMessagesAsSeen();
    queryClient.invalidateQueries({ queryKey: getListMyConversationsQueryKey() });
  }, [queryClient]);

  const lastSeenAt = useMemo(() => {
    try {
      return new Date(localStorage.getItem(VENDOR_MESSAGES_LAST_SEEN_KEY) ?? 0);
    } catch {
      return new Date(0);
    }
  }, []);

  // Auto-select the most recent conversation on first load
  const selected = useMemo(() => {
    if (selectedId !== undefined) return conversations.find((c) => c.id === selectedId);
    return conversations[0];
  }, [conversations, selectedId]);

  useEffect(() => {
    if (selectedId === undefined && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  return (
    <VendorShell
      title="Messages"
      description="Your support conversations. Reply to messages from the support team here."
    >
      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        {/* Conversation list */}
        <div className="max-h-[560px] space-y-1.5 overflow-y-auto rounded-md border border-border p-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg p-3 space-y-2">
                  <div className="h-3.5 w-32 rounded bg-muted" />
                  <div className="h-3 w-44 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              No support conversations yet. If you have a question, contact support from the Help menu.
            </p>
          ) : (
            conversations.map((c) => (
              <ConversationListItem
                key={c.id}
                conversation={c}
                active={c.id === selected?.id}
                unread={new Date(c.lastMessageAt) > lastSeenAt}
                onClick={() => setSelectedId(c.id)}
              />
            ))
          )}
        </div>

        {/* Message thread */}
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
    </VendorShell>
  );
}
