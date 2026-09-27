import { Progress } from "@/components/ui/progress"
import { Stars } from "@/components/commerce/rating"
import type { StoreProductCard } from "@/lib/products"

/** Buyer reviews: average, distribution from the published reviews, list. */
export function Reviews({ product }: { product: StoreProductCard }) {
  const reviews = product.reviews ?? []
  const count = product.ratingCount ?? 0
  const avg = product.ratingAvg
  if (!count && reviews.length === 0) {
    return (
      <div className="rounded-3xl bg-surface p-6 text-sm text-muted-foreground">
        No reviews yet. Reviews come from buyers after their order is delivered.
      </div>
    )
  }
  return (
    <div className="grid gap-8 md:grid-cols-[280px_1fr]">
      <div className="space-y-4 rounded-3xl bg-surface p-6">
        {avg != null ? (
          <div>
            <p className="text-5xl font-extrabold tabular">{avg.toFixed(1)}</p>
            <Stars value={avg} className="mt-1" />
            <p className="mt-1 text-sm text-muted-foreground">{count.toLocaleString()} rating{count === 1 ? "" : "s"}</p>
          </div>
        ) : null}
        {reviews.length > 0 ? (
          <ul className="space-y-1.5" aria-label="Rating breakdown from written reviews">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = reviews.filter((r) => r.rating === star).length
              return (
                <li key={star} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-3 tabular">{star}</span>
                  <Progress value={(n / reviews.length) * 100} className="h-1.5 flex-1" />
                  <span className="w-6 text-right tabular">{n}</span>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
      <ul className="divide-y divide-border">
        {reviews.map((r, i) => (
          <li key={i} className="space-y-1.5 py-5 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <Stars value={r.rating} />
              <time className="text-xs text-muted-foreground" dateTime={r.createdAt}>
                {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </time>
            </div>
            {r.title ? <p className="font-semibold">{r.title}</p> : null}
            <p className="text-sm leading-relaxed text-muted-foreground">{r.body}</p>
            <p className="text-xs font-medium text-success">Verified purchase</p>
            {r.vendorResponse ? (
              <div className="mt-2 rounded-2xl bg-surface p-3 text-sm">
                <p className="mb-0.5 text-xs font-semibold">Seller reply</p>
                <p className="text-muted-foreground">{r.vendorResponse}</p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
