import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductRail } from "@/components/commerce/product-grid"
import { EmptyState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { getGuide } from "@/lib/guides"

export const Route = createFileRoute("/guides/$slug")({
  component: GuidePage,
})

/** Editorial prose with live catalog picks (picks resolve to real listings). */
function GuidePage() {
  const { slug } = Route.useParams()
  const q = useQuery({ queryKey: ["store", "guide", slug], queryFn: () => getGuide(slug) })
  const d = q.data
  if (q.isLoading) return <div className="container-page max-w-3xl space-y-4 pt-8"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-64 rounded-3xl" /></div>
  if (!d) return <div className="container-page py-10"><EmptyState title="Guide not found" action={{ label: "All guides", to: "/guides" }} /></div>
  return (
    <article className="space-y-10 pt-6">
      <PageSeo title={d.guide.title} description={d.guide.excerpt} path={`/guides/${slug}`} />
      <header className="container-page max-w-3xl space-y-3">
        <Link to="/guides" className="text-sm font-semibold text-muted-foreground hover:text-foreground">← Buying guides</Link>
        <h1 className="text-4xl font-extrabold">{d.guide.title}</h1>
        <p className="text-sm text-muted-foreground">
          By {d.guide.author}
          {d.guide.publishedAt ? ` · ${new Date(d.guide.publishedAt).toLocaleDateString(undefined, { dateStyle: "long" })}` : ""}
        </p>
        {d.guide.excerpt ? <p className="text-lg text-muted-foreground">{d.guide.excerpt}</p> : null}
      </header>
      {d.sections.map((s, i) => (
        <section key={`${s.heading}-${i}`} className="space-y-5">
          <div className="container-page max-w-3xl space-y-3">
            <h2 className="text-2xl font-extrabold">{s.heading}</h2>
            {s.body.split("\n\n").map((p, j) => <p key={j} className="leading-relaxed text-muted-foreground">{p}</p>)}
          </div>
          {s.picks.map((pick, k) =>
            pick.cards.length ? (
              <div key={k} className="container-page space-y-3">
                {pick.label ? <p className="font-semibold">{pick.label}</p> : null}
                <ProductRail products={pick.cards} label={pick.label ?? s.heading} />
              </div>
            ) : null,
          )}
        </section>
      ))}
      {d.related.length ? (
        <section className="container-page max-w-3xl">
          <h2 className="mb-3 text-xl font-extrabold">Related guides</h2>
          <ul className="space-y-2">
            {d.related.map((r) => (
              <li key={r.slug}><Link to="/guides/$slug" params={{ slug: r.slug }} className="font-semibold hover:underline">{r.title}</Link></li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  )
}
