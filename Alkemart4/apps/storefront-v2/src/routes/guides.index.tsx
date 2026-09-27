import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/feedback/states"
import { PageHero } from "@/components/content/page-hero"
import { PageSeo } from "@/components/seo/page-seo"
import { listGuides } from "@/lib/guides"

export const Route = createFileRoute("/guides/")({
  component: GuidesPage,
})

function GuidesPage() {
  const q = useQuery({ queryKey: ["store", "guides"], queryFn: listGuides, staleTime: 300_000 })
  return (
    <div className="space-y-10">
      <PageSeo title="Buying guides" description="Honest buying guides with live picks from real sellers." path="/guides" />
      <PageHero tone="surface" eyebrow="Buying guides" title="Buy with confidence" lead="Short, honest guides with live picks from real sellers." />
      <section className="container-page">
        {q.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40 rounded-3xl" />)}</div>
        ) : q.data?.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {q.data.map((g) => (
              <li key={g.slug}>
                <Link to="/guides/$slug" params={{ slug: g.slug }} className="flex h-full flex-col gap-2 rounded-3xl border border-border p-6 transition-shadow hover:shadow-lift">
                  <p className="text-lg font-bold">{g.title}</p>
                  <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">{g.excerpt}</p>
                  <p className="text-xs text-muted-foreground">By {g.author}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No guides yet" description="Our first buying guides are on the way." action={{ label: "Browse products", to: "/categories" }} />
        )}
      </section>
    </div>
  )
}
