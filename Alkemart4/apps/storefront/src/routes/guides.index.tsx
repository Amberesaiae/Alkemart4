import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/skeleton"
import { Breadcrumbs } from "@/components/shell/Breadcrumbs"
import { PageSeo } from "@/components/page-seo"
import { listGuides } from "@/lib/guides"

export const Route = createFileRoute("/guides/")({
  component: GuidesPage,
})

/** Guide index (Phase 6E hub list): published guides only, never stubs. */
function GuidesPage() {
  const guidesQ = useQuery({
    queryKey: ["store", "guides"],
    queryFn: listGuides,
    staleTime: 300_000,
  })
  const guides = guidesQ.data ?? []

  return (
    <div className="space-y-6 pb-8">
      <PageSeo
        title="Buying guides"
        description="Honest buying advice for Ghana — what matters before you pay, with live picks."
        path="/guides"
      />
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Guides" }]} />
      <header className="space-y-1">
        <h1 className="type-pdp-title text-foreground">Buying guides</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Advice that cannot go stale: prices and stock always resolve live
          from the catalog, never from prose.
        </p>
      </header>
      {guidesQ.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2" role="status" aria-label="Loading guides">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : null}
      {guidesQ.isSuccess && guides.length === 0 ? (
        <EmptyState
          title="No guides yet"
          description="Editorial is getting started. Browse the market instead."
          actionLabel="Browse all"
          actionTo="/categories/$slug"
          actionParams={{ slug: "all" }}
        />
      ) : null}
      {guides.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link
                to="/guides/$slug"
                params={{ slug: g.slug }}
                className="block h-full rounded-lg border border-border bg-card p-5 hover:border-primary/60"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Guide · By {g.author}
                </p>
                <p className="mt-1 text-base font-bold text-foreground">{g.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{g.excerpt}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
