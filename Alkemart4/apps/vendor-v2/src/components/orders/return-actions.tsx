import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@workspace/console-ui/components/button"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { ReturnCaseCard } from "@workspace/console-ui/components/console/return-case"
import { formatMinor } from "@workspace/console-ui/lib/money"
import { declineReturn, refundPaid, refundReturn, replaceReturn, type OrderDetail, type ReturnCase } from "@/lib/api"
import { qk } from "@/lib/queries"

type Mode = "idle" | "refund" | "decline"

const fieldCls = "w-full rounded-2xl border bg-input/30 px-3.5 py-2.5 text-[15px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/**
 * The seller's answer to a return: refund in full, send a replacement, or
 * decline with a reason. If you want the item back before refunding, agree
 * it with the buyer in Messages first. All inline; nothing needs admin.
 */
export function ReturnPanel({ order, rc }: { order: OrderDetail; rc: ReturnCase }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<Mode>("idle")
  const [reason, setReason] = useState("")
  const cod = order.paymentMethod === "cod"
  const refundable = BigInt(order.subtotalPesewas) - BigInt(order.refundedPesewas ?? "0")

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.orders })
    void qc.invalidateQueries({ queryKey: qk.returns })
    void qc.invalidateQueries({ queryKey: qk.statement })
    void qc.invalidateQueries({ queryKey: qk.tasks })
  }
  const run = useMutation({
    mutationFn: (fn: () => Promise<ReturnCase>) => fn(),
    onSuccess: () => {
      toast.success("Done — the buyer has been told.")
      setMode("idle")
      refresh()
    },
    onError: (e: unknown) => {
      const err = e as { status?: number; message?: string }
      toast.error(err.status == null ? "No connection — nothing changed." : (err.message ?? "That didn't go through. Try again."))
      if (err.status === 409) refresh()
    },
  })
  const busy = run.isPending

  let body = null
  if (rc.status === "requested") {
    if (mode === "refund") {
      body = (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <p className="font-bold">Refund {formatMinor(refundable)} in full?</p>
          <p className="text-sm text-muted-foreground">
            {cod
              ? "The buyer paid you cash, so you pay them back yourself and mark it paid here."
              : "alkemart refunds the buyer from their payment. If you've already been paid for this order, your share comes off your next payout."}{" "}
            Want the item back first? Agree it with the buyer in Messages before you refund.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" size="lg" disabled={busy} onClick={() => run.mutate(() => refundReturn(rc.id))}>
              {busy ? <Spinner /> : null} Refund {formatMinor(refundable)}
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setMode("idle")}>
              Back
            </Button>
          </div>
        </div>
      )
    } else if (mode === "decline") {
      body = (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <label htmlFor="decline-reason" className="block font-bold">
            Why are you declining?
          </label>
          <textarea id="decline-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. It was working and sealed when it left the shop." className={fieldCls} />
          <p className="text-sm text-muted-foreground">The buyer sees this. They can accept it or ask alkemart to decide.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" size="lg" disabled={busy || reason.trim().length < 5} onClick={() => run.mutate(() => declineReturn(rc.id, reason.trim()))}>
              {busy ? <Spinner /> : null} Decline
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setMode("idle")}>
              Back
            </Button>
          </div>
        </div>
      )
    } else {
      body = (
        <div className="flex flex-wrap gap-2">
          <Button variant="brand" size="lg" onClick={() => setMode("refund")}>
            Refund in full
          </Button>
          <Button variant="outline" size="lg" disabled={busy} onClick={() => run.mutate(() => replaceReturn(rc.id))}>
            {busy ? <Spinner /> : null} Send a replacement
          </Button>
          <Button variant="ghost" size="lg" onClick={() => setMode("decline")}>
            Decline
          </Button>
        </div>
      )
    }
  } else if (rc.refund?.via === "seller" && rc.refund.status === "owed") {
    body = (
      <Button variant="brand" size="lg" disabled={busy} onClick={() => run.mutate(() => refundPaid(rc.id))}>
        {busy ? <Spinner /> : null} I've paid the buyer back
      </Button>
    )
  }

  return (
    <ReturnCaseCard rc={rc} viewer="seller">
      {body}
    </ReturnCaseCard>
  )
}
