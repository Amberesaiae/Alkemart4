import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { requireAuthBeforeLoad, useAuth } from "@/lib/auth";
import { ShopPage } from "@/components/shop/shop-page";

const SUPPORT_EMAIL = "support@alkemart.local";

export const Route = createFileRoute("/_shop/support")({
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({
    meta: [{ title: "Message support — alkemart Ghana" }],
  }),
  component: SupportPage,
});

/**
 * In-app chat hit Express stubs (down on clean slate).
 * Honest channel until Medusa support threads are ported.
 */
function SupportPage() {
  const { user } = useAuth();
  const subject = encodeURIComponent("alkemart support");
  const body = encodeURIComponent(
    [
      "Describe your issue:",
      "",
      "",
      `—`,
      `Account: ${user?.email ?? "guest"}`,
      `Customer id: ${user?.id ?? "n/a"}`,
    ].join("\n"),
  );
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

  return (
    <ShopPage width="narrow" className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Message support
        </h1>
        <p className="mt-1 text-muted-foreground">
          In-app chat is moving to the marketplace API. Until then, email us —
          we usually reply within a few hours on business days.
        </p>
      </header>

      <div className="rounded-md border border-border bg-card p-6 space-y-4">
        <p className="text-sm">
          <span className="font-semibold">Email: </span>
          <a className="text-primary underline underline-offset-4" href={mailto}>
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p className="text-sm text-muted-foreground">
          Include your order id (from{" "}
          <Link to="/orders" className="underline underline-offset-4">
            Your orders
          </Link>
          ) if the question is about a purchase.
        </p>
        <Button asChild>
          <a href={mailto}>Open email to support</a>
        </Button>
      </div>
    </ShopPage>
  );
}
