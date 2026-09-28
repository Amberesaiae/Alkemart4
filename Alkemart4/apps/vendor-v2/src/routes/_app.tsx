import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Link, Outlet, createFileRoute, redirect, useNavigate, useRouterState } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChartLineData01Icon, HelpCircleIcon, LinkSquare02Icon, Logout01Icon, Message01Icon, UserCircleIcon } from "@hugeicons/core-free-icons"
import { ConsoleShell } from "@workspace/console-ui/components/console/console-shell"
import { StatusBadge } from "@workspace/console-ui/components/console/status-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/console-ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/console-ui/components/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/console-ui/components/alert-dialog"
import { Brand } from "@/components/brand"
import { signOut } from "@/lib/api"
import { getStorefrontUrl } from "@/lib/env"
import { NAV } from "@/lib/nav"
import { useInbox, useSeller, useToPackCount } from "@/lib/queries"
import { onSessionChange, readSession } from "@/lib/session"

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ location }) => {
    if (!readSession()) throw redirect({ to: "/login", search: { redirect: location.href } })
  },
  component: AppLayout,
})

function initials(name?: string | null) {
  return (name?.trim()[0] ?? "S").toUpperCase()
}

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const qc = useQueryClient()
  const seller = useSeller()
  const toPack = useToPackCount()
  const inbox = useInbox()
  const waiting = (inbox.data?.unread ?? 0) + (inbox.data?.unansweredQuestions ?? 0)
  const [confirmOut, setConfirmOut] = useState(false)

  // A 401 anywhere clears the session; send the seller to sign in.
  useEffect(
    () =>
      onSessionChange(() => {
        if (!readSession()) {
          qc.clear()
          void navigate({ to: "/login" })
        }
      }),
    [navigate, qc],
  )

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`))
  const items = NAV.map((n) =>
    n.to === "/orders" ? { ...n, badge: toPack, badgeLabel: toPack === 1 ? "order to pack" : "orders to pack" } : n,
  )
  const shop = seller.data
  const shopUrl = shop ? `${getStorefrontUrl()}/shops/${shop.handle}` : null

  const accountMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full p-1 pr-1 hover:bg-muted sm:pr-3" aria-label="Account menu">
        <Avatar className="size-9">
          {shop?.logo ? <AvatarImage src={shop.logo} alt="" /> : null}
          <AvatarFallback className="bg-brand font-bold text-brand-foreground">{initials(shop?.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-40 truncate text-sm font-semibold sm:block">{shop?.name ?? "Your shop"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-semibold">{shop?.name}</span>
          <span className="block truncate text-muted-foreground">{shop?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">
            <HugeiconsIcon icon={UserCircleIcon} /> Account & payouts
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/business">
            <HugeiconsIcon icon={ChartLineData01Icon} /> Business & statements
          </Link>
        </DropdownMenuItem>
        {shopUrl ? (
          <DropdownMenuItem asChild>
            <a href={shopUrl} target="_blank" rel="noreferrer">
              <HugeiconsIcon icon={LinkSquare02Icon} /> View my shop
            </a>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link to="/account" hash="help">
            <HugeiconsIcon icon={HelpCircleIcon} /> Help
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setConfirmOut(true)}>
          <HugeiconsIcon icon={Logout01Icon} /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <>
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
        identity={
          shop ? (
            <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent p-3">
              <Avatar className="size-10">
                {shop.logo ? <AvatarImage src={shop.logo} alt="" /> : null}
                <AvatarFallback className="bg-brand font-bold text-brand-foreground">{initials(shop.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{shop.name}</p>
                {shop.status !== "open" ? (
                  <StatusBadge kind="seller" status={shop.status} audience="seller" className="mt-1" />
                ) : (
                  <p className="truncate text-[13px] text-sidebar-foreground/75">Your shop is open</p>
                )}
              </div>
            </div>
          ) : null
        }
        groups={[{ items }]}
        tabBar={items}
        isActive={isActive}
        renderLink={({ to, children, ...rest }) => (
          <Link to={to} {...rest}>
            {children}
          </Link>
        )}
        sidebarFooter={
          shopUrl ? (
            <a
              href={shopUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium hover:bg-sidebar-accent hover:text-white"
            >
              <HugeiconsIcon icon={LinkSquare02Icon} className="size-5" aria-hidden />
              View my shop
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null
        }
        topBar={
          <div className="flex items-center gap-1">
            <Link
              to="/messages"
              aria-label={waiting ? `Messages, ${waiting} waiting` : "Messages"}
              className="relative grid size-11 place-items-center rounded-full hover:bg-muted"
            >
              <HugeiconsIcon icon={Message01Icon} className="size-6" aria-hidden />
              {waiting ? (
                <span className="absolute top-1 right-1 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-xs font-bold text-brand-foreground tabular">{waiting}</span>
              ) : null}
            </Link>
            {accountMenu}
          </div>
        }
      >
        <Outlet />
      </ConsoleShell>

      <AlertDialog open={confirmOut} onOpenChange={setConfirmOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of alkemart?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need your email and password to sign back in. Orders keep coming in while you're signed out.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={() => void signOut().catch(() => toast.error("Sign-out did not finish. Please try again."))}>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
