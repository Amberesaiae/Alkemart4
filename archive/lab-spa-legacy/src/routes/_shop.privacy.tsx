import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { ShopPage } from "@/components/shop/shop-page";

export const Route = createFileRoute("/_shop/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — alkemart Ghana" },
      { name: "description", content: "How alkemart Ghana collects, uses and protects your data." },
      { property: "og:title", content: "Privacy Notice — alkemart Ghana" },
      { property: "og:description", content: "Privacy Notice for alkemart Ghana." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <ShopPage width="narrow" className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon /> Back to alkemart
      </Link>
      <header>
        <h1 className="font-display text-4xl font-bold tracking-tight">Privacy Notice</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated July 2026</p>
      </header>
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-foreground">What we collect</h2>
          <p>
            We collect the account details you provide (name, email, phone), the orders and messages you
            create, and basic usage information needed to run the marketplace — for example cart contents
            and order history tied to your account.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-foreground">How we use it</h2>
          <p>
            Your data is used to process orders, connect you with vendor support, moderate uploaded
            images, and secure your account session. We don't sell your personal data to third parties.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-foreground">Vendors & order data</h2>
          <p>
            When you place an order, the vendor fulfilling it can see the order's line items and status so
            they can prepare and ship it. Vendors do not see your full account profile.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-foreground">Contacting us</h2>
          <p>
            For questions about your data, reach our support team from the{" "}
            <Link to="/support" className="font-semibold text-primary underline">
              Message support
            </Link>{" "}
            page.
          </p>
        </section>
      </div>
    </ShopPage>
  );
}
