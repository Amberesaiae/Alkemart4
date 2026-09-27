import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { JusticeScale01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { getComparison, minorToMajor, type CompareColumn } from "@/lib/compare"
import { formatMoney } from "@/lib/market"
import { productParam } from "@/lib/products"
import { requireAuth } from "@/lib/route-guards"
import { cn } from "@/lib/utils"
import { COMPARE_ENABLED } from "@/lib/features"

/**
 * ⚖ Side by side. Prices are today's (the API reads the live catalogue), and
 * the lowest delivered total is marked — the rest is the buyer's call.
 * Reopening a saved comparison is free.
 */
export const Route = createFileRoute("/compare/$id")({ beforeLoad: requireAuth, component: ComparePage })

type Row = { label: string; cell: (c: CompareColumn) => React.ReactNode }

const money = (minor: string | undefined, currency?: string) => (minor == null ? "—" : formatMoney(minorToMajor(minor), currency))

function returnsText(days: number | null) {
  if (days == null) return "Ask the shop"
  if (days === 0) return "No change-of-mind returns"
  return `${days} day${days === 1 ? "" : "s"} to change your mind`
}

function ComparePage() {
  return COMPARE_ENABLED ? <CompareView /> : <ComingSoon />
}

function ComingSoon() {
  return (
    <div className="container-page max-w-xl space-y-4 py-12 text-center">
      <PageSeo title="Compare" noindex />
      <HugeiconsIcon icon={JusticeScale01Icon} className="mx-auto size-10" aria-hidden />
      <h1 className="text-3xl font-extrabold tracking-tight">Compare is coming soon</h1>
      <p className="text-muted-foreground">You'll be able to put products side by side and see the best delivered price.</p>
      <Button asChild>
        <Link to="/search">Back to shopping</Link>
      </Button>
    </div>
  )
}

function CompareView() {
  const { id } = Route.useParams()
  const q = useQuery({ queryKey: ["store", "compare", id], queryFn: () => getComparison(id) })

  if (q.isPending) {
    return (
      <div className="container-page space-y-4 pt-4 sm:pt-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    )
  }
  if (q.isError) {
    return (
      <div className="container-page pt-6">
        <ErrorState title="This comparison didn't load" error={q.error} onRetry={() => void q.refetch()} />
      </div>
    )
  }

  const { columns, tokens, missing } = q.data
  const totals = columns.map((c) => (c.best ? BigInt(c.best.totalPesewas) : null)).filter((t): t is bigint => t != null)
  const lowest = totals.length ? totals.reduce((a, b) => (b < a ? b : a)) : null
  const isLowest = (c: CompareColumn) => lowest != null && c.best != null && BigInt(c.best.totalPesewas) === lowest && totals.length > 1

  const any = (f: (c: CompareColumn) => unknown) => columns.some((c) => f(c) != null && f(c) !== "")
  const attrLabels = [...new Set(columns.flatMap((c) => c.attributes.map((a) => a.label)))]

  const rows: Row[] = [
    {
      label: "Delivered price",
      cell: (c) => (
        <span className="space-y-1">
          <span className="block text-lg font-extrabold tabular">{money(c.best?.totalPesewas, c.best?.currency)}</span>
          {isLowest(c) ? <span className="inline-block rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold">Lowest</span> : null}
        </span>
      ),
    },
    { label: "Price", cell: (c) => <span className="tabular">{money(c.best?.pricePesewas, c.best?.currency)}</span> },
    { label: "Delivery", cell: (c) => <span className="tabular">{c.best && c.best.deliveryFeePesewas !== "0" ? money(c.best.deliveryFeePesewas, c.best.currency) : "Free or pickup"}</span> },
    {
      label: "Shop",
      cell: (c) =>
        c.best ? (
          <Link to="/shops/$slug" params={{ slug: c.best.sellerHandle }} className="font-semibold underline underline-offset-4">
            {c.best.sellerName}
          </Link>
        ) : (
          "—"
        ),
    },
    { label: "Shops selling it", cell: (c) => (c.shops > 1 ? `${c.shops} shops` : "1 shop") },
    { label: "Rating", cell: (c) => (c.ratingAvg != null && c.ratingCount > 0 ? `★ ${c.ratingAvg.toFixed(1)} (${c.ratingCount})` : "No ratings yet") },
    { label: "Returns", cell: (c) => returnsText(c.returnsDays) },
    { label: "In stock", cell: (c) => (c.inStock ? "Yes" : "Sold out") },
    ...(any((c) => c.best?.condition) ? [{ label: "Condition", cell: (c: CompareColumn) => c.best?.condition ?? "—" }] : []),
    ...(any((c) => c.best?.warranty) ? [{ label: "Warranty", cell: (c: CompareColumn) => c.best?.warranty ?? "—" }] : []),
    ...(any((c) => c.best?.deliveryPromise) ? [{ label: "Delivery time", cell: (c: CompareColumn) => c.best?.deliveryPromise ?? "—" }] : []),
    ...(any((c) => c.brand) ? [{ label: "Brand", cell: (c: CompareColumn) => c.brand ?? "—" }] : []),
    ...attrLabels.map((label) => ({ label, cell: (c: CompareColumn) => c.attributes.find((a) => a.label === label)?.value ?? "—" })),
  ]

  return (
    <div className="container-page space-y-5 pt-4 pb-10 sm:pt-6">
      <PageSeo title="Compare" noindex />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <HugeiconsIcon icon={JusticeScale01Icon} className="size-7" aria-hidden /> Compare
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prices are today's, cheapest delivered offer for each. {tokens.balance} compare{tokens.balance === 1 ? "" : "s"} left.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/search">New search</Link>
        </Button>
      </div>
      {missing > 0 ? (
        <p role="status" className="rounded-2xl bg-warning/10 p-3 text-sm">
          {missing} product{missing === 1 ? " is" : "s are"} no longer on sale and left out.
        </p>
      ) : null}

      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Products side by side</caption>
          <thead>
            <tr>
              <td className="sticky left-0 z-10 w-28 bg-background sm:w-40" />
              {columns.map((c) => (
                <th key={c.productId} scope="col" className="w-[13rem] px-2 pb-3 text-left align-top font-normal">
                  <Link to="/product/$id" params={{ id: productParam({ id: c.productId, slug: c.slug }) }} className="group block space-y-2">
                    <span className="block aspect-square w-full max-w-40 overflow-hidden rounded-2xl bg-surface">
                      {c.imageUrl ? <img src={c.imageUrl} alt="" className="size-full object-contain p-[9%] mix-blend-multiply" /> : null}
                    </span>
                    <span className="line-clamp-2 font-semibold group-hover:underline">{c.title}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} className={cn(i % 2 === 0 && "[&>*]:bg-muted/40")}>
                <th scope="row" className="sticky left-0 z-10 bg-background px-2 py-2.5 text-left align-top font-semibold text-muted-foreground first:rounded-l-xl">
                  {r.label}
                </th>
                {columns.map((c) => (
                  <td key={c.productId} className="px-2 py-2.5 align-top [overflow-wrap:anywhere] last:rounded-r-xl">
                    {r.cell(c)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="sticky left-0 bg-background" />
              {columns.map((c) => (
                <td key={c.productId} className="px-2 pt-3">
                  <Button asChild className="w-full">
                    <Link to="/product/$id" params={{ id: productParam({ id: c.productId, slug: c.slug }) }}>
                      See it
                    </Link>
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
