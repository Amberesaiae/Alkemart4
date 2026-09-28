import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useSession } from "@/hooks/use-store"
import { askQuestion, listQuestions } from "@/lib/messages"

const day = (iso: string) => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso))

/**
 * Public Q&A for a product. Answered questions show to everyone; a new
 * question goes to the shop you're buying from and appears once answered.
 */
export function ProductQuestions({ productId, sellerId, sellerName }: { productId: string; sellerId: string | null; sellerName: string | null }) {
  const session = useSession()
  const q = useQuery({ queryKey: ["store", "questions", productId], queryFn: () => listQuestions(productId) })
  const [text, setText] = useState("")
  const [sent, setSent] = useState(false)
  const ask = useMutation({
    mutationFn: () => askQuestion({ productId, sellerId: sellerId!, question: text.trim() }),
    onSuccess: () => {
      setText("")
      setSent(true)
    },
    onError: (e: unknown) => toast.error((e as Error).message || "That didn't go through. Try again."),
  })
  const items = q.data?.items ?? []
  return (
    <div className="space-y-4">
      {items.length ? (
        <ul className="space-y-4">
          {items.map((x) => (
            <li key={x.id} className="space-y-1.5 border-b border-border pb-4 last:border-0">
              <p className="font-semibold [overflow-wrap:anywhere]">Q: {x.question}</p>
              <p className="[overflow-wrap:anywhere]">
                <span className="font-semibold">A:</span> {x.answer}
              </p>
              <p className="text-xs text-muted-foreground">
                {x.askerName} asked · {x.sellerName ?? "The shop"} answered{x.answeredAt ? ` ${day(x.answeredAt)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : q.isSuccess ? (
        <p className="text-sm text-muted-foreground">No questions yet.</p>
      ) : null}
      {!sellerId ? null : !session.data ? (
        <p className="text-sm">
          <Link to="/login" search={{ redirect: `/product/${productId}` }} className="font-semibold underline underline-offset-4">
            Sign in
          </Link>{" "}
          to ask {sellerName ?? "the shop"} a question.
        </p>
      ) : sent ? (
        <p role="status" className="rounded-2xl bg-surface p-3.5 text-sm">
          Sent to {sellerName ?? "the shop"}. It shows here once they answer.{" "}
          <button type="button" className="font-semibold underline underline-offset-4" onClick={() => setSent(false)}>
            Ask another
          </button>
        </p>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim().length >= 8) ask.mutate()
          }}
        >
          <Label htmlFor="ask-question">Ask {sellerName ?? "the shop"} a question</Label>
          <textarea
            id="ask-question"
            rows={2}
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Does it come with a charger?"
            className="w-full rounded-2xl border border-input bg-background px-3.5 py-2.5 text-[length:var(--text-legacy-15)] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="text-xs text-muted-foreground">Everyone can see questions and answers. For your order or delivery, message the shop instead.</p>
          <Button type="submit" size="sm" disabled={text.trim().length < 8 || ask.isPending}>
            Ask
          </Button>
        </form>
      )}
    </div>
  )
}
