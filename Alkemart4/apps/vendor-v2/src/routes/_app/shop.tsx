import { Link, createFileRoute } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@workspace/console-ui/components/button"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { PageHeader } from "@workspace/console-ui/components/console/page-header"
import { ErrorState } from "@workspace/console-ui/components/console/states"
import { cn } from "@workspace/console-ui/lib/utils"
import {
  ContactCard,
  DeliveryCard,
  LocationCard,
  LookCard,
  OpenCard,
  PolicyCard,
  SearchCard,
  ShareCard,
  SocialCard,
} from "@/components/shop/sections"
import { getStorefrontUrl } from "@/lib/env"
import { useSetup } from "@/lib/use-setup"

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "location", label: "Location" },
  { id: "delivery", label: "Delivery & returns" },
  { id: "contact", label: "Contact & hours" },
  { id: "share", label: "Share" },
] as const
type SectionId = (typeof SECTIONS)[number]["id"]

export const Route = createFileRoute("/_app/shop")({
  validateSearch: (s: Record<string, unknown>): { section?: SectionId } =>
    SECTIONS.some((x) => x.id === s.section) ? { section: s.section as SectionId } : {},
  component: ShopPage,
})

/**
 * Shop settings, one topic at a time. The tab bar replaces the old long
 * scroll of nine cards; first-run setup lives in /setup and uses the same
 * sections.
 */
function ShopPage() {
  const { section = "profile" } = Route.useSearch()
  const { shop, policy, progress } = useSetup()
  if (shop.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-11 rounded-full" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }
  if (shop.isError) return <ErrorState title="Your shop didn't load" error={shop.error} onRetry={() => void shop.refetch()} />
  const s = shop.data
  const shopUrl = `${getStorefrontUrl()}/shops/${s.handle}`
  return (
    <div className="space-y-5">
      <PageHeader
        title="Shop"
        description="How your shop looks to buyers, and what you promise them."
        actions={
          <Button asChild variant="outline" size="lg">
            <a href={shopUrl} target="_blank" rel="noopener noreferrer">
              <HugeiconsIcon icon={LinkSquare02Icon} data-icon="inline-start" /> View my shop
            </a>
          </Button>
        }
      />

      {progress && !progress.complete ? (
        <Link
          to="/setup"
          className="flex items-center gap-4 rounded-2xl bg-brand-soft p-4 transition-colors hover:bg-brand-soft/70"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-bold">
              Finish setting up · {progress.count} of {progress.total} done
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-background/70" aria-hidden>
              <div className="h-full rounded-full bg-foreground" style={{ width: `${(progress.count / progress.total) * 100}%` }} />
            </div>
          </div>
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0" aria-hidden />
        </Link>
      ) : null}

      <OpenCard s={s} />

      <nav aria-label="Shop settings" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max gap-1.5 rounded-full bg-muted p-1">
          {SECTIONS.map((x) => (
            <li key={x.id}>
              <Link
                to="/shop"
                search={{ section: x.id }}
                replace
                aria-current={section === x.id ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors",
                  section === x.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {x.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Keyed by seller data so each section's form resets after a save elsewhere. */}
      <div className="space-y-5">
        {section === "profile" ? (
          <>
            <LookCard s={s} />
            <SocialCard s={s} />
            <SearchCard s={s} url={shopUrl} />
          </>
        ) : section === "location" ? (
          <LocationCard key={JSON.stringify(s.address)} s={s} />
        ) : section === "delivery" ? (
          <>
            <DeliveryCard s={s} />
            <PolicyCard current={policy.data?.body ?? null} loading={policy.isPending} />
          </>
        ) : section === "contact" ? (
          <ContactCard s={s} />
        ) : (
          <ShareCard s={s} url={shopUrl} />
        )}
      </div>
    </div>
  )
}
