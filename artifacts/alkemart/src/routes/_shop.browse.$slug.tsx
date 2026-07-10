import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useListProducts, useAddCartItem, getGetCartQueryKey } from "@workspace/api-client-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Accordion } from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ProductCard } from "@/components/shop/product-card";
import { PillChip } from "@/components/shop/pill-chip";
import { FilterFacet } from "@/components/shop/filter-facet";

import { z } from "zod";

const browseSearchSchema = z.object({
  search: z.string().optional(),
});

export const Route = createFileRoute("/_shop/browse/$slug")({
  validateSearch: browseSearchSchema,
  head: ({ params, search }: any) => {
    const isSearch = params.slug === "search";
    const title = isSearch
      ? `Search results for "${(search as { search?: string })?.search ?? ""}"`
      : params.slug.replace(/-/g, " ");
    const capital = title.replace(/\b\w/g, (c: string) => c.toUpperCase());
    return {
      meta: [
        { title: `${capital} — alkemart Ghana` },
        {
          name: "description",
          content: isSearch
            ? `Search results for ${(search as { search?: string })?.search ?? ""} on alkemart Ghana.`
            : `Shop ${title} across top brands with everyday alkemart deals and same-hour Accra delivery.`,
        },
        { property: "og:title", content: `${capital} — alkemart Ghana` },
        { property: "og:description", content: isSearch ? `Search results.` : `Shop ${title} on alkemart Ghana.` },
      ],
    };
  },
  component: BrowsePage,
});

const filterGroups = [
  { label: "Price", items: ["Under GH₵25", "GH₵25 – GH₵50", "GH₵50 – GH₵100", "GH₵100 – GH₵200", "GH₵200+"] },
  { label: "Brand", items: ["Acme", "Nova", "Kite", "Orbit", "Halo", "Lumo"] },
  { label: "Subscription", items: ["Auto-reorder", "One-time"] },
  { label: "Walmart Cash Offers", items: ["1% back", "3% back", "5% back"] },
  { label: "Screen size", items: ['13"', '15"', '17"', '21"', '27"'] },
  { label: "Color", items: ["Black", "White", "Silver", "Blue"] },
  { label: "Features", items: ["Wireless", "Touchscreen", "Backlit", "Waterproof"] },
  { label: "Operating system", items: ["ChromeOS", "Windows", "macOS", "Linux"] },
];

const headerPills = [
  "Tech deals",
  "Pick up today",
  "Shop by brand",
  "Apple",
  "Computers & tablets",
  "Home theater",
  "Headphones",
  "Cell phones",
  "Wearable tech",
  "Smart home",
  "TV & networking",
];

function pesewasToPrice(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

const PAGE_SIZE = 24;

type SortOption = "match" | "price-asc" | "price-desc" | "rated" | "new";

function BrowsePage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const isSearch = slug === "search";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOption>("match");
  const { data, isLoading } = useListProducts({
    categorySlug: isSearch ? undefined : slug,
    search: isSearch ? (search.search ?? "") : undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const addCartItem = useAddCartItem({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }),
    },
  });

  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});

  const handleFilterToggle = (groupLabel: string, item: string) => {
    setActiveFilters((prev) => {
      const current = prev[groupLabel] ?? [];
      const next = current.includes(item)
        ? current.filter((x) => x !== item)
        : [...current, item];
      return { ...prev, [groupLabel]: next };
    });
  };

  // Reset to page 1 whenever the category/search term changes.
  const scopeKey = `${slug}:${search.search ?? ""}`;
  const [lastScopeKey, setLastScopeKey] = useState(scopeKey);
  if (scopeKey !== lastScopeKey) {
    setLastScopeKey(scopeKey);
    setPage(1);
  }

  const rawProducts = data?.items ?? [];

  const filteredProducts = rawProducts.filter((p) => {
    // Brand filter
    const selectedBrands = activeFilters["Brand"] ?? [];
    if (selectedBrands.length > 0) {
      if (!p.brand || !selectedBrands.includes(p.brand)) {
        return false;
      }
    }

    // Price filter
    const selectedPrices = activeFilters["Price"] ?? [];
    if (selectedPrices.length > 0) {
      const priceVal = p.pricePesewas / 100;
      const matchesPrice = selectedPrices.some((range) => {
        if (range === "Under GH₵25") return priceVal < 25;
        if (range === "GH₵25 – GH₵50") return priceVal >= 25 && priceVal <= 50;
        if (range === "GH₵50 – GH₵100") return priceVal >= 50 && priceVal <= 100;
        if (range === "GH₵100 – GH₵200") return priceVal >= 100 && priceVal <= 200;
        if (range === "GH₵200+") return priceVal > 200;
        return true;
      });
      if (!matchesPrice) return false;
    }

    // OS filter
    const selectedOS = activeFilters["Operating system"] ?? [];
    if (selectedOS.length > 0) {
      const matchesOS = selectedOS.some((os) =>
        p.title.toLowerCase().includes(os.toLowerCase())
      );
      if (!matchesOS) return false;
    }

    return true;
  });

  const products = [...filteredProducts].sort((a, b) => {
    switch (sort) {
      case "price-asc":
        return a.pricePesewas - b.pricePesewas;
      case "price-desc":
        return b.pricePesewas - a.pricePesewas;
      case "rated":
        return b.ratingAvgX100 - a.ratingAvgX100;
      case "new":
        return b.id - a.id;
      default:
        return 0;
    }
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const categoryLabel = isSearch
    ? `Search results for "${search.search ?? ""}"`
    : slug.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{categoryLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Category hero banner */}
      <div
        className="relative min-h-[160px] overflow-hidden rounded-md bg-primary p-8 text-primary-foreground"
      >
        <div className="text-xs font-bold uppercase tracking-widest opacity-70">
          {isSearch ? "Search" : "Category"}
        </div>
        <h1 className="mt-2 font-display text-4xl font-bold leading-tight">{categoryLabel}</h1>
      </div>

      {/* Header pills row */}
      <div className="flex flex-wrap items-center gap-2">
        {headerPills.map((p, i) => (
          <PillChip key={p} active={i === 0}>
            {p}
          </PillChip>
        ))}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort by</span>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="h-9 w-40 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="match">Best match</SelectItem>
              <SelectItem value="price-asc">Price: low to high</SelectItem>
              <SelectItem value="price-desc">Price: high to low</SelectItem>
              <SelectItem value="rated">Top rated</SelectItem>
              <SelectItem value="new">New arrivals</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Filter sidebar */}
        <aside className="lg:sticky lg:top-32 lg:h-max">
          <div className="rounded-md border border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider">
                Filters
              </h2>
              <button
                onClick={() => setActiveFilters({})}
                className="text-xs font-semibold text-primary underline"
              >
                Clear
              </button>
            </div>
            <input
              type="search"
              aria-label="Search filters"
              placeholder="Search filters"
              className="mb-3 h-9 w-full rounded-full border border-input bg-background px-4 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Accordion
              type="multiple"
              defaultValue={["Price", "Brand"]}
              className="w-full"
            >
              {filterGroups.map((g) => (
                <FilterFacet
                  key={g.label}
                  label={g.label}
                  items={g.items}
                  selectedItems={activeFilters[g.label] ?? []}
                  onToggle={(item) => handleFilterToggle(g.label, item)}
                />
              ))}
            </Accordion>
          </div>
        </aside>

        {/* Product grid */}
        <div>
          <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{categoryLabel}</span> ({total})
            </span>
            <span>Explore great deals. Prices when purchased online.</span>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="aspect-square animate-pulse rounded-md bg-black/5" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-black/5" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-black/5" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-20 text-center">
              <p className="font-display text-lg font-semibold">No results found</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {isSearch
                  ? `We couldn't find anything matching "${search.search ?? ""}". Try a different search term.`
                  : "There are no products in this category yet. Check back soon."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {products.map((p, i: number) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  tag={(p.tag as "rollback" | "clearance" | "best" | "popular" | "new" | null) ?? undefined}
                  now={pesewasToPrice(p.pricePesewas)}
                  was={p.compareAtPesewas ? pesewasToPrice(p.compareAtPesewas) : undefined}
                  rating={p.ratingCount > 0 ? p.ratingAvgX100 / 100 : undefined}
                  reviews={p.ratingCount > 0 ? p.ratingCount : undefined}
                  showAdd={i % 2 === 0}
                  showOptions={i % 2 !== 0}
                  emphasis={i % 4 === 0 ? "deal" : "default"}
                  onAdd={() => addCartItem.mutate({ data: { productId: p.id, qty: 1 } })}
                  addPending={addCartItem.isPending}
                />
              ))}
            </div>
          )}

          {!isLoading && products.length > 0 && (
            <div className="mt-10 flex flex-col items-center gap-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      aria-disabled={page <= 1}
                      tabIndex={page <= 1 ? -1 : undefined}
                      className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 1) setPage((p) => p - 1);
                      }}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink isActive tabIndex={-1}>
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      aria-disabled={page >= totalPages}
                      tabIndex={page >= totalPages ? -1 : undefined}
                      className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < totalPages) setPage((p) => p + 1);
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} results
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
