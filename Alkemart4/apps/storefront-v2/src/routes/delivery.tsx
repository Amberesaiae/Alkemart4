import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { PageHero } from "@/components/content/page-hero"
import { PageSeo } from "@/components/seo/page-seo"
import { useMarket } from "@/lib/market"

export const Route = createFileRoute("/delivery")({
  component: DeliveryPage,
})

function DeliveryPage() {
  const market = useMarket()
  const steps = [
    ["Order", "Pick items from any seller. Every seller's delivery fee shows before you pay."],
    ["Seller prepares", "Each shop packs its own items and confirms timing with you."],
    ["Rider delivers", "Riders bring it to your door. A landmark in your address helps them find you."],
    ...(market.paymentMethods.includes("cod") ? [["Pay on arrival", "Check your items with the rider, then pay."]] : []),
  ]
  return (
    <div className="space-y-12">
      <PageSeo title="Delivery" description={`How delivery works on alkemart in ${market.name}.`} path="/delivery" />
      <PageHero eyebrow="Delivery" title={`Delivery across ${market.name}`} lead={market.deliveryHint} art="/illustrations/delivery.webp">
        <Button asChild size="lg"><Link to="/categories">Start shopping</Link></Button>
      </PageHero>
      <section className="container-page">
        <h2 className="mb-5 text-2xl font-extrabold">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, b], i) => (
            <li key={t} className="space-y-2 rounded-3xl bg-surface p-5">
              <span className="grid size-9 place-items-center rounded-full bg-foreground text-sm font-bold text-background">{i + 1}</span>
              <p className="font-semibold">{t}</p>
              <p className="text-sm text-muted-foreground">{b}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="container-page max-w-3xl space-y-3">
        <h2 className="text-2xl font-extrabold">Where we deliver</h2>
        <p className="text-muted-foreground">
          Sellers choose the areas they cover. Pick your {market.regionLabel.toLowerCase()} with “Deliver to” at the top of the page and shops that serve it show first — exact fees appear at checkout.
        </p>
      </section>
    </div>
  )
}
