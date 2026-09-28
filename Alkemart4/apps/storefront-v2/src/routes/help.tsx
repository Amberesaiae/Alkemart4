import { createFileRoute, Link } from "@tanstack/react-router"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { PageHero } from "@/components/content/page-hero"
import { PageSeo } from "@/components/seo/page-seo"
import { getVendorAppUrl } from "@/lib/env"
import { useMarket } from "@/lib/market"

export const Route = createFileRoute("/help")({
  component: HelpPage,
})

/** Answers match what the platform actually does today. */
function HelpPage() {
  const market = useMarket()
  const pays = [
    market.paymentMethods.includes("cod") && "pay on delivery (cash or mobile money to the rider)",
    market.paymentMethods.includes("momo") && "mobile money",
    market.paymentMethods.includes("card") && "debit or credit card",
  ].filter(Boolean)
  const faq: [string, React.ReactNode][] = [
    ["How can I pay?", `You can ${pays.join(", ")}. Available methods show at checkout.`],
    ["How does delivery work?", "Each seller delivers their own items and sets their own delivery fee. You see every seller's fee before you pay."],
    ["Why is my cart split by seller?", "Shops on alkemart are independent. One cart can hold items from several shops; each ships its part separately."],
    ["Do I need an account?", "You can browse and fill your cart without one. Create and verify a free account to place and track orders."],
    ["How do I track an order?", <>Sign in and go to <Link to="/orders" className="font-semibold underline">Orders</Link>.</>],
    ["How do returns and refunds work?", <>Returns are handled by our support team — <Link to="/contact" className="font-semibold underline">contact us</Link> with your order reference and what went wrong. We'll work it out with the seller.</>],
    ["Where are my saved items?", "Saved items are kept on the device where you saved them. They don't move between phones or computers yet."],
    ["How do I review a purchase?", "Once an order is delivered, open it from Orders and tap “Review this order”. Reviews appear after a quick check."],
    ["How do I sell on alkemart?", <>Open the <a href={getVendorAppUrl()} className="font-semibold underline">seller workspace</a> to create your shop.</>],
  ]
  return (
    <div className="space-y-10">
      <PageSeo title="Help" description="Answers about payments, delivery, orders and returns on alkemart." path="/help" />
      <PageHero eyebrow="Help centre" title="How can we help?" lead="Payments, delivery, orders and returns — the short answers." art="/illustrations/help.webp">
        <Button asChild size="lg"><Link to="/orders">Track an order</Link></Button>
        <Button asChild size="lg" variant="outline" className="bg-background"><Link to="/contact">Contact us</Link></Button>
      </PageHero>
      <section className="container-page max-w-3xl">
        <Accordion type="single" collapsible className="rounded-3xl border border-border px-5">
          {faq.map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger className="text-base font-semibold">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  )
}
