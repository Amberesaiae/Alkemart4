import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { ShopPage } from "@/components/shop/shop-page";

export const Route = createFileRoute("/_shop/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — alkemart Ghana" },
      { name: "description", content: "The terms that govern your use of alkemart Ghana." },
      { property: "og:title", content: "Terms of Use — alkemart Ghana" },
      { property: "og:description", content: "Terms of Use for alkemart Ghana." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <ShopPage width="narrow" className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon /> Back to alkemart
      </Link>
      <header>
        <h1 className="font-display text-4xl font-bold tracking-tight">Terms of Use</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated July 2026</p>
      </header>
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-foreground">1. Using alkemart</h2>
          <p>
            By creating an account or placing an order on alkemart, you agree to shop in good faith,
            provide accurate delivery and payment information, and comply with Ghanaian law.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-foreground">2. Vendors & marketplace listings</h2>
          <p>
            Products on alkemart are listed and fulfilled by independent vendors. alkemart reviews vendor
            applications and moderates listing images, but each vendor is responsible for the accuracy of
            their own product descriptions, pricing and stock.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-foreground">3. Orders & payments</h2>
          <p>
            Placing an order is an offer to purchase, which alkemart or the relevant vendor may accept or
            decline (for example, if an item goes out of stock). Order status, fulfillment and any
            applicable returns are handled through your account's order history.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-foreground">4. Account responsibility</h2>
          <p>
            You're responsible for keeping your account credentials secure and for all activity under
            your account. Contact support immediately if you suspect unauthorized access.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-foreground">5. Changes to these terms</h2>
          <p>
            We may update these terms from time to time. Continued use of alkemart after an update
            constitutes acceptance of the revised terms.
          </p>
        </section>
      </div>
    </ShopPage>
  );
}
