import { createFileRoute, Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, FavouriteIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { formatMoney } from "@/lib/market"
import { productParam } from "@/lib/products"
import { useSavedItems } from "@/lib/wishlist"

export const Route = createFileRoute("/saved")({
  component: SavedPage,
})

/** Saved on this device — says so, so nobody expects it on another phone. */
function SavedPage() {
  const { items, remove } = useSavedItems()
  return (
    <div className="container-page space-y-6 pt-6">
      <PageSeo title="Saved" noindex />
      <header>
        <h1 className="text-3xl font-extrabold">Saved items</h1>
        <p className="mt-1 text-sm text-muted-foreground">Saved on this device. Prices shown are from when you saved — open an item for today's offers.</p>
      </header>
      {items.length === 0 ? (
        <EmptyState
          icon={FavouriteIcon}
          illustration="empty-saved"
          title="Nothing saved yet"
          description="Tap the heart on any product to keep it here."
          action={{ label: "Explore products", to: "/categories" }}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-4 rounded-3xl border border-border p-3">
              <Link to="/product/$id" params={{ id: productParam(it) }} className="size-20 shrink-0 overflow-hidden rounded-2xl bg-surface">
                {it.thumbnail ? <img src={it.thumbnail} alt="" className="size-full object-contain p-2 mix-blend-multiply" /> : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link to="/product/$id" params={{ id: productParam(it) }} className="line-clamp-2 font-medium hover:underline">
                  {it.title}
                </Link>
                {it.amount != null ? <p className="text-sm text-muted-foreground tabular">{formatMoney(it.amount, it.currencyCode)} when saved</p> : null}
              </div>
              <Button variant="ghost" size="icon" aria-label={`Remove ${it.title}`} onClick={() => remove(it.id)}>
                <HugeiconsIcon icon={Delete02Icon} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
