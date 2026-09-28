import { Link, createFileRoute } from "@tanstack/react-router"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowRight01Icon,
  Clock01Icon,
  DeliveryBox01Icon,
  Image01Icon,
  Location01Icon,
  PackageIcon,
  Tag01Icon,
  Tick02Icon,
  Wallet01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/console-ui/components/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/console-ui/components/chart"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { PageHeader, SectionTitle } from "@workspace/console-ui/components/console/page-header"
import { StatCard } from "@workspace/console-ui/components/console/stat-card"
import { StatusBadge } from "@workspace/console-ui/components/console/status-badge"
import { EmptyState, ErrorState } from "@workspace/console-ui/components/console/states"
import { formatMinor } from "@workspace/console-ui/lib/money"
import { orderReference } from "@alkemart/shared/order-ref"
import { cn } from "@workspace/console-ui/lib/utils"
import type { Task, TaskKind } from "@/lib/api"
import { TASK_ROUTE } from "@/lib/nav"
import { useOrders, useSeller, useShopStats, useStatement, useTasks } from "@/lib/queries"
import { SETUP_STEPS } from "@/lib/setup"
import { useSetup } from "@/lib/use-setup"
import { thumbFallback, thumbOf } from "@alkemart/shared/media"

export const Route = createFileRoute("/_app/")({ component: HomePage })

const TASK_ICON: Record<TaskKind, IconSvgElement> = {
  approval: Clock01Icon,
  dispatch: DeliveryBox01Icon,
  sla: Alert02Icon,
  changes: Alert02Icon,
  drafts: PackageIcon,
  stock: Tag01Icon,
  price: Tag01Icon,
  logo: Image01Icon,
  momo: Wallet01Icon,
  payout: Wallet01Icon,
  address: Location01Icon,
  returns: Alert02Icon,
}

/** Tasks that stop sales or keep buyers waiting come first and read as urgent. */
const URGENT: TaskKind[] = ["returns", "dispatch", "sla", "changes", "momo"]

function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

function HomePage() {
  const seller = useSeller()
  const today = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(new Date())
  const name = seller.data?.name

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={today} title={name ? `${greeting()}, ${name}` : greeting()} description="Here's what needs you today." />
      <ApprovalBanner />
      <SetupBanner />
      <TodoSection />
      <NumbersSection />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <ViewsCard />
        <TopProductsCard />
      </div>
      <RecentOrders />
    </div>
  )
}

/** Until setup is finished, one clear way back into it — above the to-dos. */
function SetupBanner() {
  const { progress } = useSetup()
  if (!progress || progress.complete) return null
  const next = SETUP_STEPS.find((s) => s.id === progress.firstOpen)
  return (
    <section aria-labelledby="setup-title" className="flex flex-col gap-4 rounded-2xl bg-brand-soft p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="min-w-0 flex-1 space-y-2">
        <h2 id="setup-title" className="text-lg font-extrabold">
          Finish setting up your shop
        </h2>
        <p className="text-[15px]">
          {progress.count} of {progress.total} done{next ? ` · next: ${next.title.toLowerCase()}` : ""}
        </p>
        <div className="flex gap-1.5" aria-hidden>
          {SETUP_STEPS.map((st) => (
            <span key={st.id} className={cn("h-1.5 flex-1 rounded-full", progress.done[st.id] ? "bg-foreground" : "bg-background/70")} />
          ))}
        </div>
      </div>
      <Link
        to="/setup"
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-foreground px-5 text-sm font-bold text-background hover:bg-foreground/90"
      >
        Continue setup
      </Link>
    </section>
  )
}

function ApprovalBanner() {
  const seller = useSeller()
  const s = seller.data?.status
  if (!s || s === "open") return null
  const copy =
    s === "pending_approval"
      ? {
          title: "Your shop is waiting for approval",
          body: "You can add products now. Buyers can order from you as soon as our team approves your shop — we'll let you know.",
        }
      : {
          title: s === "suspended" ? "Your shop is suspended" : "Your shop is closed",
          body: "Buyers can't order from you right now. Email hello@alkemart.app and we'll help you sort it out.",
        }
  return (
    <div
      role="status"
      className={cn("flex gap-4 rounded-2xl p-4 sm:p-5", s === "pending_approval" ? "bg-info-soft text-info" : "bg-danger-soft text-destructive")}
    >
      <HugeiconsIcon icon={s === "pending_approval" ? Clock01Icon : Alert02Icon} className="mt-0.5 size-6 shrink-0" aria-hidden />
      <div>
        <p className="font-bold">{copy.title}</p>
        <p className="mt-1 text-[15px] text-foreground/80">{copy.body}</p>
      </div>
    </div>
  )
}

function TodoSection() {
  const q = useTasks()
  // The approval task duplicates the banner above.
  const tasks = (q.data ?? []).filter((t) => t.kind !== "approval")
  const sorted = [...tasks].sort((a, b) => Number(URGENT.includes(b.kind)) - Number(URGENT.includes(a.kind)))
  return (
    <section aria-labelledby="todo-title" className="space-y-3">
      <SectionTitle id="todo-title" title="To do" />
      {q.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-2xl" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState title="Your to-do list didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : sorted.length === 0 ? (
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
          <span className="grid size-11 place-items-center rounded-full bg-success-soft text-success">
            <HugeiconsIcon icon={Tick02Icon} className="size-6" aria-hidden />
          </span>
          <div>
            <p className="font-bold">You're all caught up</p>
            <p className="text-[15px] text-muted-foreground">New orders and anything that needs you will show up here.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {sorted.map((t) => (
            <li key={t.kind}>
              <TaskRow task={t} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TaskRow({ task }: { task: Task }) {
  const route = TASK_ROUTE[task.kind]
  const urgent = URGENT.includes(task.kind)
  const body = (
    <>
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full",
          urgent ? "bg-brand text-brand-foreground" : "bg-muted text-foreground",
        )}
      >
        <HugeiconsIcon icon={TASK_ICON[task.kind]} className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{task.title}</span>
        <span className="block text-[15px] text-muted-foreground">{task.detail}</span>
      </span>
      {route ? <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0 text-muted-foreground" aria-hidden /> : null}
    </>
  )
  const cls = "flex min-h-[72px] items-center gap-4 px-4 py-3 sm:px-5"
  return route ? (
    <Link to={route.to} search={route.search} className={cn(cls, "transition-colors hover:bg-muted/60")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function NumbersSection() {
  const orders = useOrders()
  const money = useStatement()
  const stats = useShopStats()
  const toPack = orders.data?.items.filter((o) => o.status === "placed").length ?? 0
  const held = Number(money.data?.totals.heldNetPesewas ?? 0)
  const owed = Number(money.data?.totals.commissionOwedPesewas ?? 0)
  const failed = [orders, money, stats].filter((q) => q.isError)
  return (
    <section aria-labelledby="numbers-title" className="space-y-3">
      <SectionTitle
        id="numbers-title"
        title="Your shop at a glance"
        action={
          <Link to="/business" className="inline-flex min-h-10 items-center text-sm font-semibold underline-offset-4 hover:underline">
            Business overview →
          </Link>
        }
      />
      {failed.length > 0 ? (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft p-3 text-sm font-medium text-destructive">
          <HugeiconsIcon icon={Alert02Icon} className="size-4" aria-hidden />
          Some numbers didn't load.
          <button type="button" className="ml-auto underline underline-offset-4" onClick={() => failed.forEach((q) => void q.refetch())}>
            Try again
          </button>
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Orders to pack"
          icon={DeliveryBox01Icon}
          loading={orders.isPending}
          value={orders.isError ? "—" : toPack}
          hint={orders.data ? `${orders.data.count} order${orders.data.count === 1 ? "" : "s"} in total` : undefined}
        />
        <StatCard
          label="Money on the way"
          icon={Wallet01Icon}
          loading={money.isPending}
          value={money.isError ? "—" : formatMinor(money.data?.totals.pendingNetPesewas, money.data?.currency)}
          hint="Online orders delivered, not paid out yet"
        />
        {owed > 0 ? (
          <StatCard
            label="Commission you owe"
            icon={Wallet01Icon}
            value={formatMinor(owed, money.data?.currency)}
            hint={`On ${formatMinor(money.data?.totals.cashCollectedPesewas, money.data?.currency)} cash you collected`}
          />
        ) : held > 0 ? (
          <StatCard
            label="On hold"
            icon={Alert02Icon}
            value={formatMinor(held, money.data?.currency)}
            hint="See Money for the reason"
          />
        ) : (
          <StatCard
            label="Paid out so far"
            icon={Tick02Icon}
            loading={money.isPending}
            value={money.isError ? "—" : formatMinor(money.data?.totals.paidNetPesewas, money.data?.currency)}
            hint="To your mobile money"
          />
        )}
        <StatCard
          label="Shop views"
          icon={ViewIcon}
          loading={stats.isPending}
          value={stats.isError ? "—" : (stats.data?.views30d ?? 0).toLocaleString()}
          hint="Last 30 days"
        />
      </div>
    </section>
  )
}

const viewsConfig = { views: { label: "Views", color: "var(--chart-1)" } } satisfies ChartConfig

function ViewsCard() {
  const q = useShopStats()
  const series = q.data?.series ?? []
  const total = q.data?.views30d ?? 0
  const best = series.reduce((m, p) => (p.views > m.views ? p : m), { date: "", views: 0 })
  const fmt = (d: string) => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(d))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Shop views, last 30 days</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <Skeleton className="h-56 rounded-xl" />
        ) : q.isError ? (
          <ErrorState title="Views didn't load" error={q.error} onRetry={() => void q.refetch()} />
        ) : total === 0 ? (
          <EmptyState
            icon={ViewIcon}
            illustration="first-listing"
            illustrationSize="compact"
            title="No views yet"
            description="Share your shop link on WhatsApp and social media to bring your first buyers."
          />
        ) : (
          <>
            {/* Text summary for screen readers and a quick read for everyone. */}
            <p className="mb-3 text-[15px] text-muted-foreground">
              {total.toLocaleString()} views in total. Busiest day: {fmt(best.date)} ({best.views.toLocaleString()}).
            </p>
            <ChartContainer config={viewsConfig} className="h-56 w-full" aria-hidden>
              <AreaChart data={series} margin={{ left: 4, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} tickFormatter={fmt} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmt(String(v))} />} />
                <Area dataKey="views" type="monotone" fill="var(--color-views)" fillOpacity={0.35} stroke="var(--color-views)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TopProductsCard() {
  const q = useShopStats()
  const top = (q.data?.top ?? []).slice(0, 5)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Most viewed products</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState title="This didn't load" error={q.error} onRetry={() => void q.refetch()} />
        ) : top.length === 0 ? (
          <EmptyState icon={PackageIcon} title="Nothing viewed yet" description="Products buyers look at most will show here." />
        ) : (
          <ol className="space-y-3">
            {top.map((p, i) => (
              <li key={p.productId} className="flex items-center gap-3">
                <span className="w-5 text-center text-sm font-bold text-muted-foreground tabular">{i + 1}</span>
                <span className="size-12 shrink-0 overflow-hidden rounded-xl bg-surface">
                  {p.thumbnail ? <img src={thumbOf(p.thumbnail) ?? p.thumbnail} alt="" className="size-full object-cover" loading="lazy" onError={thumbFallback(p.thumbnail)} /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{p.title}</span>
                <span className="text-sm text-muted-foreground tabular">{p.views.toLocaleString()} views</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function RecentOrders() {
  const q = useOrders()
  const items = (q.data?.items ?? []).slice(0, 5)
  return (
    <section aria-labelledby="recent-title" className="space-y-3">
      <SectionTitle
        id="recent-title"
        title="Latest orders"
        action={
          <Link to="/orders" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline">
            All orders <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" aria-hidden />
          </Link>
        }
      />
      {q.isPending ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Orders didn't load" error={q.error} onRetry={() => void q.refetch()} className="rounded-2xl border bg-card" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={DeliveryBox01Icon}
          title="No orders yet"
          illustration="empty-orders"
          description="When a buyer orders from you, it shows up here and in Orders."
          className="rounded-2xl border bg-card"
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {items.map((o) => (
            <li key={o.id}>
              <Link to="/orders/$id" params={{ id: o.id }} className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-muted/60 sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Order {orderReference(o.orderGroupId)}</span>
                  <span className="block text-sm text-muted-foreground tabular">{formatMinor(o.subtotalPesewas)}</span>
                </span>
                <StatusBadge kind="order" status={o.status} audience="seller" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
