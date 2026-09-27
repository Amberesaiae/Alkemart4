import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { qk, useSession } from "@/hooks/use-store"
import { dealAction, majorToMinor, makeOffer, minorToMajor, myDeals, negotiable, type Deal } from "@/lib/deals"
import { formatMoney } from "@/lib/market"

const when = (iso: string) => new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso))

/**
 * "Make an offer" for a negotiable listing. Shows the buyer's latest offer on
 * it with the next step inline; an accepted price applies automatically in
 * the cart for that quantity (the API decides — the app never discounts).
 */
export function MakeOffer({ offerId, qty, productId, currency }: { offerId: string; qty: number; productId: string; currency: string }) {
  const session = useSession()
  const qc = useQueryClient()
  const neg = useQuery({ queryKey: ["store", "negotiable", offerId], queryFn: () => negotiable([offerId]), staleTime: 60_000 })
  const deals = useQuery({ queryKey: ["store", "deals", offerId], queryFn: () => myDeals(offerId), enabled: !!session.data && !!neg.data?.[offerId] })
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["store", "deals", offerId] })
    void qc.invalidateQueries({ queryKey: qk.cart })
  }
  const fail = (e: unknown) => toast.error((e as Error).message || "That didn't go through. Try again.")
  const send = useMutation({
    mutationFn: () => makeOffer({ offerId, qty, amountPesewas: majorToMinor(amount)! }),
    onSuccess: (r) => {
      toast[r.autoDeclined ? "error" : "success"](r.autoDeclined ? "The seller won't go that low. Try a higher offer." : "Offer sent. The seller has been asked to answer.")
      setOpen(false)
      setAmount("")
      refresh()
    },
    onError: fail,
  })
  const act = useMutation({ mutationFn: (x: { id: string; a: "accept" | "decline" | "withdraw" }) => dealAction(x.id, x.a), onSuccess: refresh, onError: fail })
  if (!neg.data?.[offerId]) return null
  if (!session.data) {
    return (
      <p className="text-sm">
        This seller takes offers.{" "}
        <Link to="/login" search={{ redirect: `/product/${productId}` }} className="font-semibold underline underline-offset-4">
          Sign in to make one
        </Link>
      </p>
    )
  }
  const latest: Deal | undefined = deals.data?.[0]
  const money = (m: string | null) => formatMoney(minorToMajor(m), currency)
  const live = latest && (latest.status === "pending" || latest.status === "countered" || latest.status === "accepted")

  return (
    <div className="space-y-2 rounded-2xl border border-border p-3.5 text-sm" aria-live="polite">
      {latest?.status === "pending" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1">
            You offered <strong>{money(latest.amountPesewas)}</strong> for {latest.qty}. The seller answers by {latest.respondBy ? when(latest.respondBy) : "soon"}.
          </p>
          <Button size="sm" variant="ghost" disabled={act.isPending} onClick={() => act.mutate({ id: latest.id, a: "withdraw" })}>
            Withdraw
          </Button>
        </div>
      ) : latest?.status === "countered" ? (
        <div className="space-y-2">
          <p>
            The seller offers <strong>{money(latest.counterPesewas)}</strong> for {latest.qty} (you offered {money(latest.amountPesewas)}). Answer by {latest.respondBy ? when(latest.respondBy) : "soon"}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: latest.id, a: "accept" })}>
              Accept {money(latest.counterPesewas)}
            </Button>
            <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ id: latest.id, a: "decline" })}>
              No thanks
            </Button>
          </div>
        </div>
      ) : latest?.status === "accepted" ? (
        <p className="rounded-xl bg-success-soft p-2.5">
          <strong>Your price: {money(latest.agreedPesewas)}</strong> for {latest.qty}. Add {latest.qty} to your cart and check out by {latest.validUntil ? when(latest.validUntil) : "soon"} — it applies automatically.
        </p>
      ) : null}
      {!live ? (
        open ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (majorToMinor(amount)) send.mutate()
            }}
          >
            <Label htmlFor={`offer-${offerId}`}>Your price for {qty}</Label>
            <div className="flex gap-2">
              <Input id={`offer-${offerId}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1700" className="h-11 w-36 tabular" />
              <Button type="submit" disabled={!majorToMinor(amount) || send.isPending}>
                Send offer
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">If the seller accepts, the price is held for you for a short time at checkout.</p>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1">
              {latest?.status === "declined" ? "Your last offer was declined. " : latest?.status === "expired" ? "Your last offer lapsed. " : ""}This seller takes offers.
            </p>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              Make an offer
            </Button>
          </div>
        )
      ) : null}
    </div>
  )
}
