import { useEffect, useState } from "react"
import { Link, Outlet, createFileRoute, redirect, useNavigate, useRouterState } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { LinkSquare02Icon, Logout01Icon } from "@hugeicons/core-free-icons"
import { ConsoleShell, type ConsoleNavGroup } from "@workspace/console-ui/components/console/console-shell"
import { Avatar, AvatarFallback } from "@workspace/console-ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/console-ui/components/dropdown-menu"
import { Brand } from "@/components/brand"
import { signOut } from "@/lib/api"
import { getStorefrontUrl } from "@/lib/env"
import { NAV_GROUPS, QUEUE_LABEL } from "@/lib/nav"
import { useAppeals, useListingsToReview, usePendingReviews, useReportedMessages, useReturnsToDecide, useSellers } from "@/lib/queries"
import { onSessionChange, readSession } from "@/lib/session"

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ location }) => {
    if (!readSession()) throw redirect({ to: "/login", search: { redirect: location.href } })
  },
  component: AppLayout,
})

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const qc = useQueryClient()
  const session = readSession()
  const [, force] = useState(0)

  useEffect(
    () =>
      onSessionChange(() => {
        force((n) => n + 1)
        if (!readSession()) {
          qc.clear()
          void navigate({ to: "/login" })
        }
      }),
    [navigate, qc],
  )

  const counts = {
    sellers: useSellers().data?.filter((s) => s.status === "pending_approval").length ?? 0,
    listings: useListingsToReview().data?.length ?? 0,
    appeals: useAppeals().data?.length ?? 0,
    reviews: usePendingReviews().data?.length ?? 0,
    returns: useReturnsToDecide().data?.counts.decide ?? 0,
    reports: useReportedMessages().data?.items.length ?? 0,
  }
  const groups: ConsoleNavGroup[] = NAV_GROUPS.map((g) => ({
    label: g.label,
    items: g.items.map((it) => (it.queue ? { ...it, badge: counts[it.queue], badgeLabel: QUEUE_LABEL[it.queue] } : it)),
  }))
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`))
  const email = session?.user.email ?? "Operator"

  return (
    <ConsoleShell
      brand={
        <>
          <span className="hidden lg:block">
            <Brand tone="light" />
          </span>
          <span className="lg:hidden">
            <Brand />
          </span>
        </>
      }
      groups={groups}
      isActive={isActive}
      renderLink={({ to, children, ...rest }) => (
        <Link to={to} {...rest}>
          {children}
        </Link>
      )}
      sidebarFooter={
        <a
          href={getStorefrontUrl() || "/"}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium hover:bg-sidebar-accent hover:text-white"
        >
          <HugeiconsIcon icon={LinkSquare02Icon} className="size-5" aria-hidden />
          Open storefront
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      }
      topBar={
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 hover:bg-muted sm:pr-3" aria-label="Account menu">
            <Avatar className="size-9">
              <AvatarFallback className="bg-foreground font-bold text-background">{email[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-48 truncate text-sm font-semibold sm:block">{email}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOut()}>
              <HugeiconsIcon icon={Logout01Icon} /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <Outlet />
    </ConsoleShell>
  )
}
