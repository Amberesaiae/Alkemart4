import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, SentIcon } from "@hugeicons/core-free-icons"
import { Button } from "../button"
import { cn } from "../../lib/utils"

export type ChatBubble = { id: string; sender: "buyer" | "seller"; body: string; at: string; warning: string | null }

const when = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso))

/**
 * A conversation's messages. `me` sits on the right; admin (reading a
 * reported thread) sees the seller on the right and labels both sides.
 * The API's payment warning shows under any flagged message.
 */
export function ChatMessages({ messages, me, labels }: { messages: ChatBubble[]; me: "buyer" | "seller"; labels?: { buyer: string; seller: string } }) {
  return (
    <ol className="space-y-3" aria-label="Messages">
      {messages.map((m) => {
        const mine = m.sender === me
        return (
          <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
            {labels ? <span className="text-xs font-semibold text-muted-foreground">{labels[m.sender]}</span> : null}
            <p
              className={cn(
                "max-w-[85%] rounded-3xl px-4 py-2.5 text-[15px] whitespace-pre-wrap [overflow-wrap:anywhere]",
                mine ? "rounded-br-lg bg-foreground text-background" : "rounded-bl-lg bg-muted",
              )}
            >
              {m.body}
            </p>
            <span className="text-xs text-muted-foreground">{when(m.at)}</span>
            {m.warning ? (
              <p role="note" className="flex max-w-[85%] items-start gap-1.5 rounded-2xl bg-warning-soft px-3 py-2 text-xs font-medium">
                <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" aria-hidden />
                {m.warning}
              </p>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** Reply box with one-tap quick replies (from the API). */
export function ChatComposer({
  id,
  quickReplies,
  pending,
  disabledReason,
  onSend,
}: {
  id: string
  quickReplies: string[]
  pending: boolean
  disabledReason?: string | null
  onSend: (body: string) => Promise<unknown>
}) {
  const [text, setText] = useState("")
  const send = async (body: string) => {
    if (!body.trim() || pending) return
    await onSend(body.trim())
    setText("")
  }
  if (disabledReason) return <p className="rounded-2xl bg-muted p-3.5 text-sm">{disabledReason}</p>
  return (
    <div className="space-y-2">
      <div className="scroll-quiet flex gap-2 overflow-x-auto pb-1" aria-label="Quick replies">
        {quickReplies.map((q) => (
          <button key={q} type="button" disabled={pending} onClick={() => void send(q)} className="min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium hover:bg-muted">
            {q}
          </button>
        ))}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send(text)
        }}
      >
        <label htmlFor={id} className="sr-only">
          Your reply
        </label>
        <textarea
          id={id}
          rows={2}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a reply"
          className="min-h-11 flex-1 resize-none rounded-2xl border bg-input/30 px-3.5 py-2.5 text-[15px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button type="submit" size="icon-lg" variant="brand" disabled={pending || !text.trim()} aria-label="Send">
          <HugeiconsIcon icon={SentIcon} />
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">Take payment only through alkemart — it protects you and the buyer.</p>
    </div>
  )
}
