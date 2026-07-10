import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import { UserAvatar } from "@/components/shop/user-avatar";
import { cn } from "@/lib/utils";
import { requireAuthBeforeLoad, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_shop/account")({
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({
    meta: [
      { title: "Your account — alkemart Ghana" },
      { name: "description", content: "Manage orders, addresses, payments, lists and alkemart+ from your account hub." },
      { property: "og:title", content: "Your account — alkemart" },
      { property: "og:description", content: "Manage orders, payments and alkemart+." },
    ],
  }),
  component: AccountPage,
});

const tiles: { title: string; body: string; to?: string; tone?: "primary" | "accent" | "default" }[] = [
  { title: "Purchase history", body: "Track, return or reorder past items.", to: "/orders", tone: "primary" },
  { title: "Lists", body: "Saved items, wish lists and registries.", to: "/account/lists" },
  { title: "Addresses", body: "Manage where alkemart delivers.", to: "/account/addresses" },
  { title: "Payment methods", body: "MoMo, cards and alkemart Pay Later.", to: "/account/payments" },
  { title: "Message support", body: "Chat with our Accra team about an order.", to: "/support" },
];

function Tile({ title, body, to, tone = "default" }: (typeof tiles)[number]) {
  const Comp: any = to ? Link : "div";
  return (
    <Comp
      to={to}
      className={cn(
        "flex flex-col justify-between gap-6 rounded-md border border-border p-6 transition-colors hover:border-primary",
        tone === "primary" && "bg-primary text-primary-foreground border-transparent",
        tone === "accent" && "bg-accent text-accent-foreground border-transparent",
        tone === "default" && "bg-background",
      )}
      style={{ minHeight: 180 }}
    >
      <div>
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm opacity-80">{body}</p>
      </div>
      <div className="flex items-center gap-1 text-sm font-semibold underline underline-offset-4">
        Open <ChevronRightIcon />
      </div>
    </Comp>
  );
}

function AccountPage() {
  const { user } = useAuth();
  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : "there";
  const firstName = user?.firstName ?? "there";

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-10 px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-5">
          <UserAvatar size="lg" name={displayName} isMember />
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Welcome back
            </div>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">Hi, {firstName}</h1>
            <p className="mt-1 text-muted-foreground">Accra, Osu • Delivery as fast as 1 hour</p>
          </div>
        </div>
        <span className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-foreground">
          alkemart+ member
        </span>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Tile key={t.title} {...t} />
        ))}
      </section>
    </div>
  );
}
