import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  CustomerSupportIcon,
  Delete02Icon,
  FavouriteIcon,
  Message01Icon,
  Location01Icon,
  Logout01Icon,
  Notification01Icon,
  PackageIcon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { PageSeo } from "@/components/seo/page-seo"
import { requireAuth } from "@/lib/route-guards"
import { logout } from "@/lib/auth"
import { addressSummary, getAccount, listAddresses } from "@/lib/account"
import { deleteSubscription, listBuyerPreferences, listMySubscriptions, setBuyerPreference } from "@/lib/notifications"
import { formatMoney, useMarket } from "@/lib/market"
import { listMyOrders, maskOrderId } from "@/lib/orders"
import { useSavedItems } from "@/lib/wishlist"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/account")({
  beforeLoad: () => requireAuth(),
  component: AccountPage,
})

const STATUS_WORD: Record<string, string> = { placed: "Being packed", shipped: "On the way", delivered: "Delivered", cancelled: "Cancelled" }

function Tile({ to, icon, title, body, accent }: { to: string; icon: IconSvgElement; title: string; body: React.ReactNode; accent?: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "group flex min-h-32 flex-col justify-between gap-3 rounded-3xl p-4 transition-transform hover:-translate-y-0.5 sm:p-5",
        accent ? "bg-brand text-brand-foreground" : "bg-surface",
      )}
    >
      <span className={cn("grid size-11 place-items-center rounded-full", accent ? "bg-background/70" : "bg-background")}>
        <HugeiconsIcon icon={icon} className="size-5" aria-hidden />
      </span>
      <span>
        <span className="flex items-center gap-1 font-bold">
          {title}
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
        <span className={cn("line-clamp-2 text-sm", accent ? "text-foreground/80" : "text-muted-foreground")}>{body}</span>
      </span>
    </Link>
  )
}

function AccountPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const market = useMarket()
  const saved = useSavedItems().items.length
  const account = useQuery({ queryKey: ["store", "account"], queryFn: getAccount, staleTime: 60_000 })
  const addresses = useQuery({ queryKey: ["store", "account", "addresses"], queryFn: listAddresses, staleTime: 60_000 })
  const orders = useQuery({ queryKey: ["store", "my-orders"], queryFn: listMyOrders, staleTime: 30_000 })

  const prefsQ = useQuery({ queryKey: ["store", "preferences"], queryFn: listBuyerPreferences })
  const subsQ = useQuery({ queryKey: ["store", "subscriptions"], queryFn: listMySubscriptions })
  const setPref = useMutation({
    mutationFn: setBuyerPreference,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store", "preferences"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save"),
  })
  const unsubscribe = useMutation({
    mutationFn: deleteSubscription,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store", "subscriptions"] }),
  })
  const signOut = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["store"] })
      void navigate({ to: "/", replace: true })
    },
  })
  const promo = prefsQ.data?.find((p) => p.category === "promotional")
  const ops = prefsQ.data?.find((p) => p.category === "operational")
  const a = account.data
  const name = a?.firstName || a?.email?.split("@")[0] || "there"
  const moving = (orders.data ?? []).filter((o) => o.fulfillmentStatus === "placed" || o.fulfillmentStatus === "shipped").length
  const def = addresses.data?.find((x) => x.isDefault)
  const recent = (orders.data ?? []).slice(0, 3)

  return (
    <div className="container-page max-w-3xl space-y-6 pt-4 sm:pt-6">
      <PageSeo title="Account" noindex />
      <header className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{a?.email ?? " "}</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Hi, {name} 👋</h1>
      </header>

      <nav aria-label="Account" className="grid grid-cols-2 gap-3">
        <Tile
          to="/orders"
          icon={PackageIcon}
          title="Orders"
          accent={moving > 0}
          body={orders.isPending ? "…" : moving > 0 ? `${moving} on the way to you` : orders.data?.length ? "Track and reorder" : "Nothing yet"}
        />
        <Tile
          to="/account/addresses"
          icon={Location01Icon}
          title="Addresses"
          body={addresses.isPending ? "…" : def ? addressSummary(def) : "Save one for faster checkout"}
        />
        <Tile to="/account/settings" icon={Shield01Icon} title="Profile & security" body="Name, phone and password" />
        <Tile to="/messages" icon={Message01Icon} title="Messages" body="Your conversations with shops" />
        <Tile to="/saved" icon={FavouriteIcon} title="Saved" body={saved ? `${saved} item${saved === 1 ? "" : "s"}` : "Heart items to find them later"} />
      </nav>

      <section aria-labelledby="recent-title" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="recent-title" className="text-lg font-bold">
            Latest orders
          </h2>
          {orders.data?.length ? (
            <Link to="/orders" className="inline-flex min-h-11 items-center text-sm font-semibold hover:underline">
              See all
            </Link>
          ) : null}
        </div>
        {orders.isPending ? (
          <Skeleton className="h-24 rounded-3xl" />
        ) : orders.isError ? (
          <p className="rounded-3xl border border-border p-4 text-[length:var(--text-legacy-15)] text-muted-foreground">
            Your orders didn't load.{" "}
            <button type="button" className="font-semibold text-foreground underline" onClick={() => void orders.refetch()}>
              Try again
            </button>
          </p>
        ) : recent.length === 0 ? (
          <p className="rounded-3xl border border-border p-4 text-sm text-muted-foreground">
            No orders yet.{" "}
            <Link to="/" className="font-semibold text-foreground underline underline-offset-4">
              Start shopping
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border">
            {recent.map((o) => (
              <li key={o.id}>
                <Link to="/order/$id" params={{ id: o.id }} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-muted/60 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {maskOrderId(o.id)} · {STATUS_WORD[o.fulfillmentStatus] ?? o.fulfillmentStatus}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">{o.items.map((i) => i.title).join(", ")}</span>
                  </span>
                  <span className="text-sm font-semibold tabular">{formatMoney(o.total, o.currencyCode)}</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="notif-title" className="space-y-4 rounded-3xl border border-border p-4 sm:p-6">
        <h2 id="notif-title" className="flex items-center gap-2 text-lg font-bold">
          <HugeiconsIcon icon={Notification01Icon} className="size-5" aria-hidden /> Notifications
        </h2>
        {prefsQ.isLoading ? (
          <Skeleton className="h-16 rounded-2xl" />
        ) : prefsQ.isError ? (
          <p className="text-sm text-muted-foreground">Notification settings aren't available right now.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <Label htmlFor="pref-ops" className="flex-col items-start gap-0.5 font-normal">
                <span className="font-semibold">Delivery updates</span>
                <span className="text-sm text-muted-foreground">Sent and delivered messages. Receipts are always sent.</span>
              </Label>
              <Switch id="pref-ops" checked={ops?.optedIn ?? true} onCheckedChange={(v) => setPref.mutate({ category: "operational", optedIn: v })} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <Label htmlFor="pref-promo" className="flex-col items-start gap-0.5 font-normal">
                <span className="font-semibold">Deals and offers</span>
                <span className="text-sm text-muted-foreground">Occasional promotions. Off unless you turn it on.</span>
              </Label>
              <Switch id="pref-promo" checked={promo?.optedIn ?? false} onCheckedChange={(v) => setPref.mutate({ category: "promotional", optedIn: v })} />
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="alerts-title" className="space-y-3 rounded-3xl border border-border p-4 sm:p-6">
        <h2 id="alerts-title" className="text-lg font-bold">
          Price & stock alerts
        </h2>
        {subsQ.data?.length ? (
          <ul className="divide-y divide-border">
            {subsQ.data.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-[length:var(--text-legacy-15)]">
                <Link to="/product/$id" params={{ id: s.productId }} className="min-w-0 hover:underline">
                  {s.kind === "back_in_stock"
                    ? "Back in stock"
                    : `Price below ${formatMoney(Number(s.belowPesewas ?? 0) / market.currency.minorUnitsPerMajor)}`}
                </Link>
                <Button variant="ghost" size="icon-sm" aria-label="Remove alert" onClick={() => unsubscribe.mutate(s.id)}>
                  <HugeiconsIcon icon={Delete02Icon} />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No alerts. Use “Notify me” on an out-of-stock product.</p>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="outline" size="lg">
          <Link to="/help">
            <HugeiconsIcon icon={CustomerSupportIcon} data-icon="inline-start" /> Help & support
          </Link>
        </Button>
        <Button variant="outline" size="lg" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
          <HugeiconsIcon icon={Logout01Icon} data-icon="inline-start" /> Sign out
        </Button>
      </div>
    </div>
  )
}
