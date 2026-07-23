import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShopPage } from "@/components/shop/shop-page";
import { HELP_TOPICS, HELP_FAQ } from "@/lib/commerce-content";

export const Route = createFileRoute("/_shop/help")({
  head: () => ({
    meta: [
      { title: "Help center — alkemart Ghana" },
      {
        name: "description",
        content: "Get help with orders, returns, payments and alkemart+ in Ghana.",
      },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const filteredFaq = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HELP_FAQ.filter((f) => {
      const matchesTopic = !activeTopic || (f.topics as readonly string[]).includes(activeTopic);
      const matchesQuery =
        !q ||
        f.q.toLowerCase().includes(q) ||
        f.topics.some((t) => t.toLowerCase().includes(q));
      return matchesTopic && matchesQuery;
    });
  }, [query, activeTopic]);

  return (
    <ShopPage width="narrow" className="space-y-10">
      <header className="rounded-md bg-secondary p-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">How can we help?</h1>
        <div className="relative mx-auto mt-6 max-w-xl">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search help articles"
            placeholder="Search help articles"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-full bg-card pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {HELP_TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTopic((prev) => (prev === t ? null : t))}
            className={cn(
              "rounded-md border border-border bg-card p-5 text-left transition-colors hover:border-primary",
              activeTopic === t && "border-primary bg-secondary/40",
            )}
          >
            <div
              className={cn("h-8 w-8 rounded-full bg-secondary", activeTopic === t && "bg-primary/30")}
            />
            <div className="mt-3 font-semibold">{t}</div>
          </button>
        ))}
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Popular questions</h2>
            {(activeTopic || query) && (
              <button
                type="button"
                onClick={() => {
                  setActiveTopic(null);
                  setQuery("");
                }}
                className="text-xs font-semibold text-link hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          {filteredFaq.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No help articles match your search. Try a different term or{" "}
              <Link to="/support" className="font-semibold text-link hover:underline">
                message support
              </Link>
              .
            </div>
          ) : (
            <Accordion type="single" collapsible className="rounded-md border border-border bg-card">
              {filteredFaq.map((f, i) => (
                <AccordionItem key={i} value={`q-${i}`} className="px-4">
                  <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
        <aside className="space-y-3 rounded-md border border-border bg-card p-6">
          <div className="text-lg font-bold">Still need help?</div>
          <p className="text-sm text-muted-foreground">
            Our support team is available daily. Chat for order and account help.
          </p>
          <Button className="w-full font-bold" asChild>
            <Link to="/support">Chat with alkemart</Link>
          </Button>
        </aside>
      </section>
    </ShopPage>
  );
}
