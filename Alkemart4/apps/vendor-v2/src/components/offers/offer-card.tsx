import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@workspace/console-ui/components/button"
import { Input } from "@workspace/console-ui/components/input"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { formatMinor, parseMajorToMinor, timeAgo } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { dealAnswer, type SellerDeal } from "@/lib/api"
import { qk } from "@/lib/queries"

const when = (iso: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso))

const STATUS: Record<SellerDeal["status"], string> = {
  pending: "Waiting for you",
  countered: "Waiting for the buyer",
  accepted: "Accepted — price held for the buyer",
  used: "Bought at this price",
  declined: "Declined",
  expired: "Lapsed",
  withdrawn: "Withdrawn by the buyer",
}

/** One buyer offer with the seller's answer inline: accept, counter or decline. */
export function OfferCard({ d }: { d: SellerDeal }) {
  const qc = useQueryClient()
  const [countering, setCountering] = useState(false)
  const [amount, setAmount] = useState("")
  const minor = parseMajorToMinor(amount)
  const counterBad = !minor || BigInt(minor) <= BigInt(d.amountPesewas) || BigInt(minor) >= BigInt(d.listPricePesewas)
  const m = useMutation({
    mutationFn: (x: { action: "accept" | "decline" | "counter"; amount?: string }) => dealAnswer(d.id, x.action, x.amount),
    onSuccess: (_r, x) => {
      toast.success(x.action === "accept" ? "Accepted — the buyer can check out at this price." : x.action === "counter" ? "Counter-offer sent." : "Declined.")
      setCountering(false)
      void qc.invalidateQueries({ queryKey: ["deals"] })
      void qc.invalidateQueries({ queryKey: qk.messages })
    },
    onError: (e: unknown) => toast.error((e as Error).message || "That didn't go through. Try again."),
  })
  const pending = d.status === "pending"
  const off = Number(BigInt(d.listPricePesewas) - BigInt(d.amountPesewas)) / Number(BigInt(d.listPricePesewas))
  return (
    <div className={cn("space-y-3 rounded-2xl border bg-card p-4", pending && "border-warning bg-warning-soft")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link to="/products/$id" params={{ id: d.productId }} className="font-semibold hover:underline">
          {d.productTitle ?? "Product"}
        </Link>
        <span className="text-sm text-muted-foreground">
          {d.buyerName} · {timeAgo(d.createdAt)}
        </span>
      </div>
      <p className="text-[15px]">
        Offers <strong className="tabular">{formatMinor(d.amountPesewas)}</strong> {d.qty > 1 ? `each for ${d.qty}` : ""} · your price {formatMinor(d.listPricePesewas)} ({Math.round(off * 100)}% less)
        {d.counterPesewas ? <> · you countered {formatMinor(d.counterPesewas)}</> : null}
      </p>
      <p className="text-sm font-semibold">
        {d.status === "declined" && d.timeline.some((t) => t.by === "system") ? "Declined for you — under your lowest price" : STATUS[d.status]}
        {pending && d.respondBy ? ` — answer by ${when(d.respondBy)}, or it lapses` : ""}
        {d.status === "accepted" && d.validUntil ? ` until ${when(d.validUntil)}` : ""}
      </p>
      {pending ? (
        countering ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Your counter-offer</span>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 w-32 text-base tabular" aria-describedby={`counter-hint-${d.id}`} />
            </label>
            <Button size="lg" variant="brand" disabled={counterBad || m.isPending} onClick={() => m.mutate({ action: "counter", amount: minor! })}>
              {m.isPending ? <Spinner /> : null} Send
            </Button>
            <Button size="lg" variant="ghost" onClick={() => setCountering(false)}>
              Back
            </Button>
            <p id={`counter-hint-${d.id}`} className={cn("w-full text-xs", amount && counterBad ? "text-destructive" : "text-muted-foreground")}>
              Between {formatMinor(d.amountPesewas)} and {formatMinor(d.listPricePesewas)}.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="lg" variant="brand" disabled={m.isPending} onClick={() => m.mutate({ action: "accept" })}>
              Accept {formatMinor(d.amountPesewas)}
            </Button>
            <Button size="lg" variant="outline" onClick={() => setCountering(true)}>
              Counter
            </Button>
            <Button size="lg" variant="ghost" disabled={m.isPending} onClick={() => m.mutate({ action: "decline" })}>
              Decline
            </Button>
          </div>
        )
      ) : null}
    </div>
  )
}
