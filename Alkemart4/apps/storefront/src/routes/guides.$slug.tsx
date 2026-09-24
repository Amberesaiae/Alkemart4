import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/skeleton"
import { Breadcrumbs } from "@/components/shell/Breadcrumbs"
import { PageSeo } from "@/components/page-seo"
import { itemListJsonLd, truncateMeta } from "@/lib/seo"
import { getGuide } from "@/lib/guides"

export const Route = createFileRoute("/guides/$slug")({
  component: GuidePage,
})

/**
 * Editorial buying guide (Phase 6E): prose plus live catalog picks.
 * Prices and stock resolve at serve time — the page never embeds them.
 */
function GuidePage() {
  const { slug } = Route.useParams()
  const guideQ = useQuery({
    queryKey: ["store", "guide", slug],
    queryFn: () => getGuide(slug),
  })

  const detail = guideQ.data ?? null
  const guide = detail?.guide ?? null
  const path = `/guides/${slug}`
  const allCards = (detail?.sections ?? []).flatMap((s) =>
    s.picks.flatMap((p) => p.cards),
  )

  return (
    <div className="space-y-8 pb-8">
      {guide ? (
        <PageSeo
          title={guide.title}
          description={truncateMeta(guide.excerpt)}
          path={path}
          jsonLd={itemListJsonLd({
            name: guide.title,
            description: guide.excerpt,
            path,
            items: allCards.slice(0, 50).map((c) => ({
              name: c.title,
              path: `/product/${c.id}`,
            })),
          })}
        />
      ) : null}
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Guides", to: "/guides" },
          { label: guide?.title ?? "Guide" },
        ]}
      />
      {guideQ.isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading guide">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : null}
      {guideQ.isSuccess && !guide ? (
        <EmptyState
          title="Guide not found"
          description="This guide is draft, removed, or never existed."
          actionLabel="All guides"
          actionTo="/guides"
        />
      ) : null}
      {guide && detail ? (
        <article className="space-y-8">
          <header className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Buying guide · By {guide.author}
              {guide.publishedAt
                ? ` · ${new Date(guide.publishedAt).toLocaleDateString()}`
                : ""}
            </p>
            <h1 className="type-pdp-title text-foreground">{guide.title}</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {guide.excerpt}
            </p>
          </header>
          {detail.sections.map((section, i) => (
            <section key={`${section.heading}-${i}`} className="space-y-3">
              <h2 className="type-section text-foreground">{section.heading}</h2>
              {section.body.split("\n\n").map((para, j) => (
                <p
                  key={j}
                  className="max-w-2xl text-sm leading-relaxed text-foreground/90"
                >
                  {para}
                </p>
              ))}
              {section.picks.map((pick, k) => (
                <div key={`${pick.label ?? "picks"}-${k}`} className="space-y-2">
                  {pick.label ? (
                    <h3 className="text-sm font-bold text-foreground">{pick.label}</h3>
                  ) : null}
                  {pick.cards.length > 0 ? (
                    <ProductGridShell>
                      {pick.cards.slice(0, 8).map((card) => (
                        <ProductCard key={card.id} product={card} size="tile" />
                      ))}
                    </ProductGridShell>
                  ) : null}
                </div>
              ))}
            </section>
          ))}
          {detail.related.length > 0 ? (
            <section className="space-y-3 border-t border-border pt-8" aria-label="Related guides">
              <h2 className="type-section text-foreground">Keep reading</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {detail.related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      to="/guides/$slug"
                      params={{ slug: r.slug }}
                      className="block rounded-2xl border border-border bg-card p-4 hover:border-primary/60"
                    >
                      <p className="text-sm font-bold text-foreground">{r.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {r.excerpt}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      ) : null}
    </div>
  )
}
