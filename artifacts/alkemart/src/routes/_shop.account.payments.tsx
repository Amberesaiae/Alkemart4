import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeftIcon } from "@radix-ui/react-icons";

export const Route = createFileRoute("/_shop/account/payments")({
  head: () => ({
    meta: [
      { title: "Payment methods — alkemart Ghana" },
      { name: "description", content: "How alkemart Ghana accepts payment: Mobile Money and cash on delivery." },
      { property: "og:title", content: "Payment methods — alkemart Ghana" },
      { property: "og:description", content: "MoMo and cash on delivery." },
      { property: "og:url", content: "/account/payments" },
    ],
    links: [{ rel: "canonical", href: "/account/payments" }],
  }),
  component: PaymentsPage,
});

const methods = [
  {
    name: "Mobile Money",
    detail: "MTN Mobile Money, Vodafone Cash or AirtelTigo Money — charged securely through Paystack at checkout.",
  },
  {
    name: "Cash on delivery",
    detail: "Pay the courier in cash when your order arrives. No charge is made up front.",
  },
];

function PaymentsPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10">
      <Link to="/account" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon /> Back to account
      </Link>
      <header className="mt-4">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Payment methods</h1>
        <p className="mt-1 text-muted-foreground">You choose how to pay each time you check out — nothing is saved on file.</p>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {methods.map((m) => (
          <div key={m.name} className="rounded-md border border-border bg-background p-5">
            <div className="font-semibold">{m.name}</div>
            <p className="mt-2 text-sm text-muted-foreground">{m.detail}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
