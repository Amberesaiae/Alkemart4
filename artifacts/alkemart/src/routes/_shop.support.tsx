import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMyConversations,
  useCreateMyConversation,
  useCreateConversationMessage,
  useListConversationMessages,
  getListMyConversationsQueryKey,
  getListConversationMessagesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { requireAuthBeforeLoad, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_shop/support")({
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({
    meta: [{ title: "Message support — alkemart Ghana" }],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading } = useListMyConversations();
  const conversation = conversations?.[0];

  const startConversation = useCreateMyConversation({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMyConversationsQueryKey() }),
    },
  });

  const sendMessage = useCreateConversationMessage({
    mutation: {
      onSuccess: () => {
        setDraft("");
        if (conversation) {
          queryClient.invalidateQueries({ queryKey: getListConversationMessagesQueryKey(conversation.id) });
        }
      },
    },
  });

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    if (!conversation) {
      startConversation.mutate({ data: { subject: "Support request", message: body } });
      setDraft("");
      return;
    }
    sendMessage.mutate({ id: conversation.id, data: { body } });
  }

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-6 px-6 py-10">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Message support</h1>
        <p className="mt-1 text-muted-foreground">Our Accra team replies here — usually within a few hours.</p>
      </header>

      <div className="rounded-md border border-border">
        {isLoading ? (
          <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : conversation ? (
          <MessageThread conversationId={conversation.id} userId={user?.id} bottomRef={bottomRef} />
        ) : (
          <div className="flex h-[420px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Send a message below to start a conversation with our support team.
          </div>
        )}

        <div className="flex items-end gap-2 border-t border-border p-3">
          <Textarea
            value={draft}
            aria-label="Describe what you need help with…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder="Describe what you need help with…"
            className="resize-none"
          />
          <Button onClick={handleSend} disabled={sendMessage.isPending || startConversation.isPending || !draft.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageThread({
  conversationId,
  userId,
  bottomRef,
}: {
  conversationId: number;
  userId: number | undefined;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { data: messages } = useListConversationMessages(conversationId, {
    query: { queryKey: getListConversationMessagesQueryKey(conversationId), refetchInterval: 4000 },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, bottomRef]);

  return (
    <div className="h-[420px] space-y-3 overflow-y-auto p-4">
      {(messages ?? []).map((message) => {
        const isMine = message.senderId === userId;
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
  );
}
