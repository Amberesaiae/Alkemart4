import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@workspace/console-ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/console-ui/components/card"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { ErrorState } from "@workspace/console-ui/components/console/states"
import { getDeliveryPolicy, saveDeliveryPolicy, type DeliveryPolicy } from "@/lib/settings"

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  const delivery = useQuery({ queryKey: ["settings", "delivery-policy"], queryFn: getDeliveryPolicy })
  return (
    <div className="space-y-5">
      <PageHeader title="Rules" description="Platform rules you can change without a release. Changes apply from the next delivery; nothing already settled moves." />
      {delivery.isPending ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : delivery.isError ? (
        <ErrorState title="Delivery rules didn't load" error={delivery.error} onRetry={() => void delivery.refetch()} />
      ) : (
        <PolicyCard
          key={JSON.stringify(delivery.data.policy)}
          title="Delivery & trust"
          description={`Sellers are trusted by default: they can always mark an order delivered. The buyer's code or "I got it" pays them at once; otherwise the buyer gets a short window to report a problem. Admin only steps in when a buyer and seller can't sort a report out.`}
          fields={DELIVERY_FIELDS}
          policy={delivery.data.policy}
          defaults={delivery.data.defaults}
          save={saveDeliveryPolicy}
          queryKey="delivery-policy"
        />
      )}
    </div>
  )
}

type Field<P> = { id: string; label: string; hint: string; unit: string; get: (p: P) => number; set: (p: P, v: number) => P }

const DELIVERY_FIELDS: Field<DeliveryPolicy>[] = [
  {
    id: "same-day",
    label: "Report window — same-day orders",
    hint: "After a seller marks delivered without the buyer's code, the buyer has this long to report a problem before the seller is paid.",
    unit: "hours",
    get: (p) => p.reportWindowHours.sameDay,
    set: (p, v) => ({ ...p, reportWindowHours: { ...p.reportWindowHours, sameDay: v } }),
  },
  {
    id: "multi-day",
    label: "Report window — other orders",
    hint: "The same, for orders promised in more than a day.",
    unit: "hours",
    get: (p) => p.reportWindowHours.multiDay,
    set: (p, v) => ({ ...p, reportWindowHours: { ...p.reportWindowHours, multiDay: v } }),
  },
  {
    id: "town-km",
    label: "Same-town distance",
    hint: "A pinned buyer this close to the seller pays the seller's same-town delivery fee.",
    unit: "km",
    get: (p) => p.sameTownKm,
    set: (p, v) => ({ ...p, sameTownKm: v }),
  },
  {
    id: "code-tries",
    label: "Handover code tries",
    hint: "Wrong codes before code checking stops for an order. Sellers can still mark it delivered.",
    unit: "tries",
    get: (p) => p.handoverMaxFailures,
    set: (p, v) => ({ ...p, handoverMaxFailures: v }),
  },
]

function PolicyCard<P>({
  title,
  description,
  fields,
  policy,
  defaults,
  save: saveFn,
  queryKey,
}: {
  title: string
  description: string
  fields: Field<P>[]
  policy: P
  defaults: P
  save: (p: P) => Promise<unknown>
  queryKey: string
}) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.id, String(f.get(policy))])))
  const next = fields.reduce<P | null>((acc, f) => {
    const n = Number(draft[f.id])
    return acc && draft[f.id]?.trim() !== "" && Number.isFinite(n) ? f.set(acc, n) : null
  }, policy)
  const dirty = !!next && JSON.stringify(next) !== JSON.stringify(policy)
  const save = useMutation({
    mutationFn: () => saveFn(next!),
    onSuccess: () => {
      toast.success("Rules saved.")
      void qc.invalidateQueries({ queryKey: ["settings", queryKey] })
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "Couldn't save."),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.id} className="space-y-1.5">
              <Label htmlFor={f.id}>{f.label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={f.id}
                  inputMode="decimal"
                  className="w-28 tabular"
                  value={draft[f.id]}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.id]: e.target.value }))}
                  aria-describedby={`${f.id}-hint`}
                />
                <span className="text-sm text-muted-foreground">{f.unit}</span>
              </div>
              <p id={`${f.id}-hint`} className="text-xs text-muted-foreground">
                {f.hint} Default: {f.get(defaults)} {f.unit}.
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Spinner /> : null} Save rules
          </Button>
          <Button size="lg" variant="ghost" onClick={() => setDraft(Object.fromEntries(fields.map((f) => [f.id, String(f.get(defaults))])))}>
            Use defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
