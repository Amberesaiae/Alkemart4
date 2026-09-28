import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Location01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { PageSeo } from "@/components/seo/page-seo"
import { useMarket } from "@/lib/market"

export const Route = createFileRoute("/delivery")({
  component: DeliveryPage,
})

function DeliveryPage() {
  const market = useMarket()
  const illustrations = ["order", "prepare", "deliver", "arrival"]
  const steps = [
    ["Order", "Pick your items. Check delivery fees at checkout."],
    ["Seller packs", "Your shop packs up and confirms the timing."],
    ["Rider delivers", "To your door. Add a landmark so it’s easy to find."],
    ...(market.paymentMethods.includes("cod") ? [["All yours", "Check your items. Pay on arrival if available."]] : []),
  ]
  return (
    <div className="container-page space-y-10 pt-4 pb-8 sm:space-y-16 sm:pt-6">
      <PageSeo title="Delivery" description={`How delivery works on alkemart in ${market.name}.`} path="/delivery" />
      <section aria-labelledby="delivery-title" className="overflow-hidden rounded-2xl bg-surface">
        <div className="flex flex-col justify-center gap-4 p-5 sm:p-8 lg:p-10">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Shopping, delivered</p>
          <h1 id="delivery-title" className="max-w-md text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">From the shop to your doorstep.</h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Your seller arranges delivery. Fees show at checkout.</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="brand" size="lg"><Link to="/categories">Start shopping</Link></Button>
            <Button asChild variant="outline" size="lg"><a href="#delivery-steps">How it works</a></Button>
          </div>
        </div>
      </section>
      <section id="delivery-steps" className="scroll-mt-24" aria-labelledby="delivery-steps-title">
        <h2 id="delivery-steps-title" className="mb-6 text-2xl font-extrabold">A few simple steps</h2>
        <ol className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {steps.map(([t, b], i) => (
            <li key={t} className="space-y-3 border-t border-border pt-5 text-left">
              <img src={`/illustrations/delivery-${illustrations[i]}-v1.webp`} alt="" width={1280} height={1280} loading="lazy" decoding="async" className="size-28 object-contain sm:size-36" />
              <h3 className="flex items-center gap-2 font-bold"><span className="text-sm tabular text-muted-foreground">0{i + 1}</span>{t}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{b}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="grid gap-6 rounded-2xl bg-surface p-5 sm:p-8 md:grid-cols-2 md:gap-10" aria-labelledby="delivery-area-title">
        <div className="space-y-3">
        <HugeiconsIcon icon={Location01Icon} className="size-8" aria-hidden />
        <h2 id="delivery-area-title" className="text-2xl font-extrabold">Set your location</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Choose your {market.regionLabel.toLowerCase()} at the top to find shops that deliver to you.
        </p>
        </div>
        <div>
          <h3 className="mb-4 font-bold">Before checkout</h3>
          <ul className="space-y-3">
            {["Add your phone number.", "Add your address and a landmark.", "Check delivery fees and payment options."].map(item => (
              <li key={item} className="flex items-start gap-3 text-sm"><HugeiconsIcon icon={Tick02Icon} className="mt-0.5 size-4 shrink-0" aria-hidden /><span>{item}</span></li>
            ))}
          </ul>
        </div>
      </section>
      <section className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-10" aria-labelledby="delivery-faq-title">
        <div className="space-y-3">
          <h2 id="delivery-faq-title" className="text-2xl font-extrabold">Quick answers</h2>
          <Button asChild variant="outline"><Link to="/help">More help</Link></Button>
        </div>
        <Accordion type="single" collapsible>
          {[
            ["Delivery cost?", "Each seller sets their fee. Check it at checkout before paying."],
            ["When will it arrive?", "Timing varies by seller and location. Confirm it with your shop."],
            ["Ordering from different shops?", "Expect separate deliveries and fees for each seller."],
            ["Need to change your address?", "Message your shop before dispatch to confirm the change."],
          ].map(([title, body], i) => (
            <AccordionItem key={title} value={`delivery-${i}`}>
              <AccordionTrigger className="font-semibold">{title}</AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">{body}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  )
}
