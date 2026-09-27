import { createFileRoute } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { PageHero } from "@/components/content/page-hero"
import { PageSeo } from "@/components/seo/page-seo"
import { getVendorAppUrl } from "@/lib/env"
import { useMarket } from "@/lib/market"

export const Route = createFileRoute("/sell")({
  component: SellPage,
})

function SellPage() {
  const market = useMarket()
  const hub = getVendorAppUrl()
  const steps = [
    ["Open your shop", "Create a seller account, add your logo, story and delivery fee."],
    ["List products", "Add photos, prices and stock. Your listings appear to every buyer."],
    ["Get orders", "Pack and deliver your own orders. Buyers see your shop, ratings and reviews."],
    ["Get paid", "Payments are settled to your verified payout account."],
  ]
  return (
    <div className="space-y-12">
      <PageSeo title="Sell on alkemart" description={`Open a shop on alkemart and reach buyers across ${market.name}.`} path="/sell" />
      <PageHero eyebrow="For sellers" title="Sell on alkemart" lead={`Your shop in front of buyers across ${market.name}. No website to build.`} art="/images/hero/sell.webp">
        <Button asChild size="xl">
          <a href={`${hub}/register`}>Open a seller account <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" /></a>
        </Button>
        <Button asChild size="xl" variant="outline" className="bg-background">
          <a href={hub}>Seller sign in</a>
        </Button>
      </PageHero>
      <section className="container-page">
        <h2 className="mb-5 text-2xl font-extrabold">How selling works</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, b], i) => (
            <li key={t} className="space-y-2 rounded-3xl bg-surface p-5">
              <span className="grid size-9 place-items-center rounded-full bg-brand text-sm font-bold">{i + 1}</span>
              <p className="font-semibold">{t}</p>
              <p className="text-sm text-muted-foreground">{b}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
