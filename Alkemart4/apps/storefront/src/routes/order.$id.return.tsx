import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui"
import { ErrorAlert } from "@/components/error-alert"
import { Skeleton } from "@/components/skeleton"
import { formInputClassName } from "@/components/form-field"
import { getOrder } from "@/lib/orders"
import { getMedusaClient } from "@/lib/medusa"
import { getBackendUrl, getPublishableKey } from "@/lib/env"

const EMAIL_KEY = "alkemart.storefront.order_lookup_email"

export const Route = createFileRoute("/order/$id/return")({
  component: ReturnRequestPage,
})

function readStoredEmail(): string {
  try {
    return localStorage.getItem(EMAIL_KEY)?.trim() || ""
  } catch {
    return ""
  }
}

type ReturnReason = {
  id: string
  label: string
  description?: string | null
}

function ReturnRequestPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [email] = useState(() => readStoredEmail())

  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [reasonId, setReasonId] = useState("")
  const [note, setNote] = useState("")

  const orderQ = useQuery({
    queryKey: ["store", "order", id, email || ""],
    queryFn: () => getOrder(id, { email: email || undefined }),
    retry: false,
  })

  const reasonsQ = useQuery({
    queryKey: ["store", "return-reasons"],
    queryFn: async () => {
      const base = getBackendUrl()
      const pk = getPublishableKey()
      const res = await fetch(`${base}/store/return-reasons`, {
        headers: {
          Accept: "application/json",
          "x-publishable-api-key": pk,
        },
      })
      if (!res.ok) throw new Error("Failed to load return reasons")
      const data = await res.json() as { return_reasons: ReturnReason[] }
      return data.return_reasons
    },
    staleTime: 300_000,
  })

  const submitReturn = useMutation({
    mutationFn: async () => {
      const base = getBackendUrl()
      const pk = getPublishableKey()
      const sdk = getMedusaClient()
      const token = await sdk.client.getToken()
      const items = Object.entries(selectedItems)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, qty]) => ({
          id: itemId,
          quantity: qty,
          ...(reasonId ? { reason_id: reasonId } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }))
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-publishable-api-key": pk,
      }
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch(`${base}/store/returns`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          order_id: id,
          items,
          receive_now: false,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string }
        throw new Error(body.message || `Return request failed (${res.status})`)
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store", "order", id] })
      navigate({ to: "/order/$id", params: { id } })
    },
  })

  const order = orderQ.data
  const reasons = reasonsQ.data
  const canSubmit = Object.values(selectedItems).some((q) => q > 0)

  function toggleItem(itemId: string, maxQty: number) {
    setSelectedItems((prev) => {
      if (prev[itemId]) {
        const next = { ...prev }
        delete next[itemId]
        return next
      }
      return { ...prev, [itemId]: maxQty }
    })
  }

  function updateQty(itemId: string, qty: number) {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: Math.max(1, Math.min(qty, 99)),
    }))
  }

  const formatGhs = (amount = 0) =>
    new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(amount)

  if (orderQ.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 pb-8">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    )
  }

  if (orderQ.isError || !order) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 pb-8">
        <ErrorAlert
          message={
            orderQ.error instanceof Error
              ? orderQ.error.message
              : "Order not found"
          }
        />
        <Button asChild variant="outline">
          <Link to="/order/$id" params={{ id }}>Back to order</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <nav className="text-xs text-muted-foreground">
        <Link to="/order/$id" params={{ id }} className="hover:underline">
          Order
        </Link>
        <span className="mx-1">/</span>
        <span className="font-medium text-foreground">Request return</span>
      </nav>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Request a return</h1>
        <p className="text-sm text-muted-foreground">
          Select the items you want to return and tell us why.
        </p>
      </div>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return
          submitReturn.mutate()
        }}
      >
        <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-bold">Items</h2>
          {order.items
            .filter((i) => i.title)
            .map((item) => {
              const isSelected = !!selectedItems[item.id]
              return (
                <label
                  key={item.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border/80 bg-background hover:border-muted-foreground/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleItem(item.id, item.quantity)}
                    className="h-5 w-5 rounded border-border accent-primary shrink-0"
                  />
                  {item.thumbnail ? (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-xl border border-border object-cover bg-muted"
                    />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatGhs(item.unitPrice ? item.unitPrice / 100 : 0)}
                    </p>
                  </div>
                  {isSelected ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          updateQty(item.id, (selectedItems[item.id] || 1) - 1)
                        }}
                        className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-sm font-bold hover:bg-muted"
                        disabled={(selectedItems[item.id] || 1) <= 1}
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm font-bold tabular-nums">
                        {selectedItems[item.id] || 0}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          updateQty(item.id, (selectedItems[item.id] || 1) + 1)
                        }}
                        className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-sm font-bold hover:bg-muted"
                        disabled={(selectedItems[item.id] || 0) >= item.quantity}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Qty: {item.quantity}
                    </span>
                  )}
                </label>
              )
            })}
        </section>

        <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-bold">Reason</h2>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reason
            </span>
            <select
              value={reasonId}
              onChange={(e) => setReasonId(e.target.value)}
              className={formInputClassName()}
            >
              <option value="">Select a reason…</option>
              {reasons?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe the issue…"
              rows={3}
              className={formInputClassName()}
            />
          </label>
        </section>

        {submitReturn.isError ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {submitReturn.error instanceof Error
              ? submitReturn.error.message
              : "Failed to submit return request"}
          </div>
        ) : null}

        {submitReturn.isSuccess ? (
          <div className="rounded-2xl border border-success/40 bg-success/5 p-4 text-sm text-success">
            Return request submitted. The seller will review it shortly.
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            size="lg"
            className="min-h-12 flex-1 rounded-xl"
            disabled={!canSubmit || submitReturn.isPending}
            isLoading={submitReturn.isPending}
          >
            Submit return request
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="min-h-12 flex-1 rounded-xl"
          >
            <Link to="/order/$id" params={{ id }}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
