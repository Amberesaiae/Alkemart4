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

export const Route = createFileRoute("/_shop/help")({
  head: () => ({
    meta: [
      { title: "Help center — alkemart Ghana" },
      { name: "description", content: "Get help with orders, returns, payments and alkemart+ in Ghana." },
      { property: "og:title", content: "Help center — alkemart" },
      { property: "og:description", content: "Answers, contact and support for alkemart Ghana." },
    ],
  }),
  component: HelpPage,
});

const topics = ["Orders", "Returns", "Payments", "alkemart+", "Delivery", "Account"];
const faq = [
  {
    q: "How fast can alkemart deliver in Accra?",
    a: "Express delivery lands in as fast as one hour across Osu, Cantonments, East Legon and Airport Residential.",
    topics: ["Delivery", "Orders"],
  },
  {
    q: "Which payment methods are supported?",
    a: "MTN MoMo, Vodafone Cash, AirtelTigo Money, all major cards and alkemart Pay Later.",
    topics: ["Payments"],
  },
  {
    q: "How do I return an item?",
    a: "Open the order, tap Start return, choose a reason, and drop the item at any alkemart hub within 14 days.",
    topics: ["Returns", "Orders"],
  },
  {
    q: "What comes with alkemart+?",
    a: "Free express delivery on eligible orders, exclusive prices, and early access to drops.",
    topics: ["alkemart+", "Account"],
  },
];

function HelpPage() {
  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const filteredFaq = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faq.filter((f) => {
      const matchesTopic = !activeTopic || f.topics.includes(activeTopic);
      const matchesQuery =
        !q ||
        f.q.toLowerCase().includes(q) ||
        f.topics.some((t) => t.toLowerCase().includes(q));
      return matchesTopic && matchesQuery;
    });
  }, [query, activeTopic]);

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-10 px-6 py-10">
      <header className="rounded-md bg-secondary p-10 text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight text-primary">How can we help?</h1>
        <div className="relative mx-auto mt-6 max-w-xl">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search help articles"
            placeholder="Search help articles"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-full bg-background pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {topics.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTopic((prev) => (prev === t ? null : t))}
            className={cn(
              "rounded-md border border-border bg-background p-5 text-left transition-colors hover:border-primary",
              activeTopic === t && "border-primary bg-secondary/40",
            )}
          >
            <div className={cn("h-8 w-8 rounded-full bg-secondary", activeTopic === t && "bg-primary/30")} />
            <div className="mt-3 font-semibold">{t}</div>
          </button>
        ))}
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Popular questions</h2>
            {(activeTopic || query) && (
              <button
                type="button"
                onClick={() => {
                  setActiveTopic(null);
                  setQuery("");
                }}
                className="text-xs font-semibold text-primary underline"
              >
                Clear filters
              </button>
            )}
          </div>
          {filteredFaq.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
              No help articles match your search. Try a different term or{" "}
              <Link to="/support" className="font-semibold text-primary underline">
                message support
              </Link>
              .
            </div>
          ) : (
            <Accordion type="single" collapsible className="rounded-md border border-border bg-background">
              {filteredFaq.map((f, i) => (
                <AccordionItem key={i} value={`q-${i}`} className="px-4">
                  <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
        <aside className="space-y-3 rounded-md border border-border bg-background p-6">
          <div className="font-display text-lg font-bold">Still need help?</div>
          <p className="text-sm text-muted-foreground">
            Our Accra team is on WhatsApp 7am–10pm daily.
          </p>
          <Button className="w-full" asChild>
            <Link to="/support">Chat with alkemart</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <a href="tel:+233300000000">Call +233 30 000 0000</a>
          </Button>
        </aside>
      </section>
    </div>
  );
}
