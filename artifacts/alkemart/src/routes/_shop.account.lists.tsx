import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusIcon, ChevronLeftIcon } from "@radix-ui/react-icons";
import { ProductCard } from "@/components/shop/product-card";
import { SectionHeader } from "@/components/shop/section-header";

export const Route = createFileRoute("/_shop/account/lists")({
  head: () => ({
    meta: [
      { title: "Lists — alkemart Ghana" },
      { name: "description", content: "Save-for-later, wish lists and baby registry — everything you want to buy next." },
      { property: "og:title", content: "Lists — alkemart Ghana" },
      { property: "og:description", content: "Saved lists and registries on alkemart." },
      { property: "og:url", content: "/account/lists" },
    ],
    links: [{ rel: "canonical", href: "/account/lists" }],
  }),
  component: ListsPage,
});

const lists = [
  { title: "Kitchen restock", count: 12, tone: "brand" as const },
  { title: "Harmattan skin kit", count: 6, tone: "accent" as const },
  { title: "Baby registry — Nov 2026", count: 24, tone: "default" as const },
];

function ListsPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10">
      <Link to="/account" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon /> Back to account
      </Link>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Your lists</h1>
          <p className="mt-1 text-muted-foreground">Save it now, buy it later. Share with family for group ordering.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <PlusIcon /> New list
        </button>
      </header>

      <section className="mt-10 space-y-14">
        {lists.map((list) => (
          <div key={list.title}>
            <SectionHeader title={list.title} eyebrow={`${list.count} items`} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCard
                  key={i}
                  now={String(9 + i * 3)}
                  was={String(15 + i * 3)}
                  rating={4}
                  reviews={"1.2k"}
                  imageTone={list.tone}
                  showAdd
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
