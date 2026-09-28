import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Location01Icon, Logout01Icon, Mail01Icon, Wallet01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/console-ui/components/card"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Switch } from "@workspace/console-ui/components/switch"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { ErrorState } from "@workspace/console-ui/components/console/states"
import { signOut } from "@/lib/api"
import { workosEnabled, workosBrowser } from "@/lib/workos"
import { qk } from "@/lib/queries"
import { getAlerts, getShop, requestResetLink, setAlert, type AlertTopic } from "@/lib/shop"

export const Route = createFileRoute("/_app/account")({
  component: AccountPage,
})

function AccountPage() {
  const q = useQuery({ queryKey: [...qk.seller, "full"], queryFn: getShop, staleTime: 60_000 })
  if (q.isPending) return <Skeleton className="h-96 rounded-2xl" />
  if (q.isError) return <ErrorState title="Your account didn't load" error={q.error} onRetry={() => void q.refetch()} />
  const s = q.data
  return (
    <div className="space-y-5">
      <PageHeader title="Account" description="Sign-in, alerts, and shortcuts to your location and payouts." />
      <SignInCard email={s.email} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where you dispatch from</CardTitle>
          <CardDescription>
            {s.address?.city || s.address?.province ? [s.address.district, s.address.city, s.address.province].filter(Boolean).join(", ") : "Not set yet."} Your pin and rider
            landmark live in Shop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="lg">
            <Link to="/shop" search={{ section: "location" }}>
              <HugeiconsIcon icon={Location01Icon} data-icon="inline-start" /> Open location
            </Link>
          </Button>
        </CardContent>
      </Card>
      <AlertsCard />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout details</CardTitle>
          <CardDescription>Your MoMo number, payouts and statement live in Money.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="lg">
            <Link to="/money" hash="payout-account">
              <HugeiconsIcon icon={Wallet01Icon} data-icon="inline-start" /> Open Money
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function SignInCard({ email }: { email: string | null }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const reset = useMutation({
    mutationFn: () => requestResetLink(email!),
    onSuccess: () => toast.success(`We sent a link to ${email}. It works once, for an hour.`),
    onError: () => toast.error("Couldn't send the link. Try again in a minute."),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign-in</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="flex items-center gap-2 text-[15px]">
          <HugeiconsIcon icon={Mail01Icon} className="size-5" aria-hidden /> {email ?? "—"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" disabled={!email || reset.isPending} onClick={() => workosEnabled ? void workosBrowser.start({}).catch(() => toast.error("Could not open secure sign-in.")) : reset.mutate()}>
            {reset.isPending ? <Spinner /> : null} {workosEnabled ? "Open secure sign-in & recovery" : "Email me a password-change link"}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              void signOut().then(() => { qc.clear(); void navigate({ to: "/login" }) }).catch(() => toast.error("Sign-out did not finish. Please try again."))
            }}
          >
            <HugeiconsIcon icon={Logout01Icon} data-icon="inline-start" /> Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const TOPIC_TEXT: Record<AlertTopic, { title: string; body: string }> = {
  order: { title: "New orders", body: "Show new orders as tasks on Home." },
  sla: { title: "Late orders", body: "Warn me when an order is close to its send-by time." },
  stock: { title: "Low stock", body: "Tell me when an item is running out." },
  price: { title: "Stale prices", body: "Remind me about prices I haven't checked in a while." },
  payout: { title: "Payout problems", body: "Tell me when a payout didn't go through or was returned." },
}

function AlertsCard() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ["alerts"], queryFn: getAlerts })
  const toggle = useMutation({
    mutationFn: ({ topic, on }: { topic: AlertTopic; on: boolean }) => setAlert(topic, on),
    onMutate: ({ topic, on }) => {
      qc.setQueryData(["alerts"], (old: { topic: AlertTopic; optedIn: boolean }[] | undefined) => old?.map((t) => (t.topic === topic ? { ...t, optedIn: on } : t)))
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["alerts"] })
      void qc.invalidateQueries({ queryKey: ["tasks"] })
    },
    onError: () => toast.error("Couldn't save that setting."),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alerts on your dashboard</CardTitle>
        <CardDescription>What shows up as a to-do on Home. (Text alerts come later.)</CardDescription>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <ul className="divide-y">
            {(q.data ?? []).map((t) => (
              <li key={t.topic} className="flex items-center justify-between gap-4 py-3">
                <label htmlFor={`alert-${t.topic}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block font-semibold">{TOPIC_TEXT[t.topic].title}</span>
                  <span className="block text-sm text-muted-foreground">{TOPIC_TEXT[t.topic].body}</span>
                </label>
                <Switch id={`alert-${t.topic}`} checked={t.optedIn} onCheckedChange={(on) => toggle.mutate({ topic: t.topic, on })} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
