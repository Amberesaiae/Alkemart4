import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { PageHero } from "@/components/content/page-hero"
import { PageSeo } from "@/components/seo/page-seo"
import { organizationJsonLd } from "@/lib/seo"

export const Route = createFileRoute("/about")({
  component: AboutPage,
})

const PILLARS = [
  ["Many sellers, one place", "Independent shops in one place — no single-store lock-in."],
  ["Honest listings", "Prices, stock and ratings come straight from sellers and buyers. Nothing is invented to look busy."],
  ["Each shop, its own promise", "Sellers fulfil their own orders and set their own delivery fees, shown before you pay."],
  ["Pay the way you do", "On delivery, by mobile money or by card — whatever the market supports."],
]

function AboutPage() {
  return (
    <div className="space-y-12">
      <PageSeo title="About" description="alkemart is a multi-seller marketplace: shop local, pay your way." path="/about" jsonLd={organizationJsonLd()} />
      <PageHero eyebrow="About alkemart" title="Many sellers. More choices. Better prices." lead="We help shoppers discover shops and check out with confidence — and help independent sellers reach every buyer." art="/illustrations/about.webp">
        <Button asChild size="lg"><Link to="/categories">Browse products</Link></Button>
        <Button asChild size="lg" variant="outline" className="bg-background"><Link to="/contact">Contact us</Link></Button>
      </PageHero>
      <section className="container-page">
        <h2 className="mb-5 text-2xl font-extrabold">What makes alkemart different</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PILLARS.map(([t, b]) => (
            <li key={t} className="rounded-3xl bg-surface p-6">
              <p className="text-lg font-bold">{t}</p>
              <p className="mt-1 text-muted-foreground">{b}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
