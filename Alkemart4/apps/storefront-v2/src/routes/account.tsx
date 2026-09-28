import type { ReactNode } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  CustomerSupportIcon,
  Delete02Icon,
  DeliveryTruck01Icon,
  FavouriteIcon,
  InformationCircleIcon,
  LinkSquare02Icon,
  Location01Icon,
  Logout01Icon,
  Mail01Icon,
  Message01Icon,
  Notification01Icon,
  PackageIcon,
  Shield01Icon,
  Store04Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { PageSeo } from "@/components/seo/page-seo"
import { useSession } from "@/hooks/use-store"
import { logout } from "@/lib/auth"
import { addressSummary, getAccount, listAddresses } from "@/lib/account"
import { getVendorAppUrl } from "@/lib/env"
import { deleteSubscription, listBuyerPreferences, listMySubscriptions, setBuyerPreference } from "@/lib/notifications"
import { formatMoney, useMarket } from "@/lib/market"
import { listMyOrders } from "@/lib/orders"
import { useSavedItems } from "@/lib/wishlist"
import { cn } from "@/lib/utils"

/**
 * The Account tab. Signed out, it's a welcome with sign-in and the help a
 * guest needs — never a bounce to a bare sign-in form. Signed in, it's the
 * buyer's profile and one list of rows, each with an icon and one line.
 */
export const Route = createFileRoute("/account")({
  component: AccountPage,
})

type Row = { label: string; icon: IconSvgElement; to?: string; href?: string; detail?: ReactNode; accent?: boolean }

function MenuList({ label, rows }: { label: string; rows: Row[] }) {
  return (
    <nav aria-label={label}>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {rows.map((r) => (
          <li key={r.label}>
            <MenuRow {...r} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

function MenuRow({ label, icon, to, href, detail, accent }: Row) {
  const body = (
    <>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", accent ? "bg-brand text-brand-foreground" : "bg-surface")}>
        <HugeiconsIcon icon={icon} className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block leading-tight font-semibold">{label}</span>
        {detail ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span> : null}
      </span>
      <HugeiconsIcon icon={href ? LinkSquare02Icon : ArrowRight01Icon} className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </>
  )
  const cls = "flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2"
  return href ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <Link to={to!} className={cls}>
      {body}
    </Link>
  )
}

const HELP_ROWS: Row[] = [
  { label: "Help and support", icon: CustomerSupportIcon, to: "/help", detail: "Answers and order problems" },
  { label: "Contact us", icon: Mail01Icon, to: "/contact" },
  { label: "Sell on alkemart", icon: Store04Icon, href: getVendorAppUrl(), detail: "Open your own shop" },
  { label: "About alkemart", icon: InformationCircleIcon, to: "/about" },
]

function AccountPage() {
  const session = useSession()
  return (
    <div className="container-page max-w-xl space-y-5 pt-4 sm:pt-8">
      <PageSeo title="Account" noindex />
      {session.isPending ? (
        <>
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </>
      ) : session.data ? (
        <MemberAccount />
      ) : (
        <GuestAccount />
      )}
    </div>
  )
}

function GuestAccount() {
  return (
    <>
      <h1 className="text-[1.375rem] font-extrabold tracking-tight sm:text-3xl">Account</h1>
      <section aria-labelledby="welcome-title" className="rounded-2xl bg-brand p-4 text-brand-foreground">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-background/70">
            <HugeiconsIcon icon={UserIcon} className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="welcome-title" className="text-lg leading-tight font-extrabold">
              Welcome to alkemart
            </h2>
            <p className="mt-0.5 text-sm text-foreground/80">Sign in to track orders, save addresses and check out.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button asChild size="lg">
            <Link to="/login" search={{ redirect: "/account" }}>
              Sign in
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-transparent bg-background hover:bg-background/90">
            <Link to="/login" search={{ redirect: "/account", mode: "register" }}>
              Create account
            </Link>
          </Button>
        </div>
      </section>
      <MenuList
        label="Shopping"
        rows={[
          { label: "Saved items", icon: FavouriteIcon, to: "/saved", detail: "Hearted products, on this device" },
          { label: "Track an order", icon: PackageIcon, to: "/orders", detail: "Sign in to see your orders" },
          { label: "Delivery", icon: DeliveryTruck01Icon, to: "/delivery", detail: "How shops deliver and what it costs" },
        ]}
      />
      <MenuList label="Help and alkemart" rows={HELP_ROWS} />
    </>
  )
}

function MemberAccount() {
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
  const fullName = [a?.firstName, a?.lastName].filter(Boolean).join(" ")
  const name = fullName || a?.email?.split("@")[0] || "Your account"
  const initials = (fullName || a?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
  const moving = (orders.data ?? []).filter((o) => o.fulfillmentStatus === "placed" || o.fulfillmentStatus === "shipped").length
  const def = addresses.data?.find((x) => x.isDefault)

  return (
    <>
      <h1 className="sr-only">Account</h1>
      <Link
        to="/account/settings"
        className="flex items-center gap-3 rounded-2xl border border-border p-4 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-brand text-lg font-extrabold text-brand-foreground">
          {account.isPending ? "" : initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg leading-tight font-extrabold">{account.isPending ? " " : name}</span>
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">{a?.email ?? " "}</span>
          <span className="sr-only">Edit profile</span>
        </span>
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>

      <MenuList
        label="Shopping"
        rows={[
          {
            label: "Orders",
            icon: PackageIcon,
            to: "/orders",
            accent: moving > 0,
            detail: orders.isPending ? "…" : moving > 0 ? `${moving} on the way to you` : orders.data?.length ? "Track and reorder" : "Nothing yet",
          },
          { label: "Addresses", icon: Location01Icon, to: "/account/addresses", detail: addresses.isPending ? "…" : def ? addressSummary(def) : "Save one for faster checkout" },
          { label: "Saved items", icon: FavouriteIcon, to: "/saved", detail: saved ? `${saved} item${saved === 1 ? "" : "s"}` : "Heart items to find them later" },
          { label: "Messages", icon: Message01Icon, to: "/messages", detail: "Your conversations with shops" },
          { label: "Profile and security", icon: Shield01Icon, to: "/account/settings", detail: "Name, phone and password" },
        ]}
      />

      <section aria-labelledby="notif-title" className="space-y-4 rounded-2xl border border-border p-4">
        <h2 id="notif-title" className="flex items-center gap-2 text-base font-bold">
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

      <section aria-labelledby="alerts-title" className="space-y-3 rounded-2xl border border-border p-4">
        <h2 id="alerts-title" className="text-base font-bold">
          Price and stock alerts
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

      <MenuList label="Help and alkemart" rows={HELP_ROWS} />

      <Button variant="outline" size="lg" className="w-full" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
        <HugeiconsIcon icon={Logout01Icon} data-icon="inline-start" /> Sign out
      </Button>
    </>
  )
}
