import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useListProducts } from "@/lib/hooks-products";
import { useAddCartItem } from "@/lib/hooks-cart";
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
import { ProductCardSkeletonGrid } from "@/components/shop/product-card-skeleton";
import { PillChip } from "@/components/shop/pill-chip";
import { FilterFacet } from "@/components/shop/filter-facet";
import { pesewasToPrice } from "@/lib/money";
import { ShopPage } from "@/components/shop/shop-page";
import {
  PAGE_SIZE_PLP,
  PLP_FILTER_GROUPS,
  PLP_QUICK_FILTERS,
  plpPriceBandMatchers,
} from "@/lib/commerce-content";

import { z } from "zod";
import { useMemo } from "react";

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
            : `Shop ${title} on alkemart Ghana — multi-vendor marketplace deals.`,
        },
        { property: "og:title", content: `${capital} — alkemart Ghana` },
        { property: "og:description", content: isSearch ? `Search results.` : `Shop ${title} on alkemart Ghana.` },
      ],
    };
  },
  component: BrowsePage,
});

const PAGE_SIZE = PAGE_SIZE_PLP;

type SortOption = "match" | "price-asc" | "price-desc" | "rated" | "new";

function BrowsePage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const isSearch = slug === "search";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOption>("match");
  const isTagBrowse = !isSearch && ["rollback", "clearance", "best", "popular", "new"].includes(slug);
  const isAllBrowse = slug === "all" || slug === "deals";
  const { data, isLoading, isPending, isError } = useListProducts({
    categorySlug: isSearch || isTagBrowse || isAllBrowse ? undefined : slug,
    tag: isTagBrowse ? slug : undefined,
    search: isSearch ? (search.search ?? "") : undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  // Don't trap PLP on infinite retry skeletons when API is offline
  const showLoading = (isPending || isLoading) && !isError;
  const addCartItem = useAddCartItem();

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

  // Brand facet derived from current result set (not a hardcoded Acme/Nova list)
  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of rawProducts) {
      if (p.brand) set.add(p.brand);
    }
    return Array.from(set).sort();
  }, [rawProducts]);

  const filterGroups = useMemo(
    () =>
      PLP_FILTER_GROUPS.map((g) =>
        g.label === "Brand" ? { label: g.label, items: brandOptions } : { label: g.label, items: [...g.items] },
      ).filter((g) => g.items.length > 0 || g.label === "Brand"),
    [brandOptions],
  );

  const filteredProducts = rawProducts.filter((p) => {
    // Brand filter (client-side on current page until API facets exist)
    const selectedBrands = activeFilters["Brand"] ?? [];
    if (selectedBrands.length > 0) {
      if (!p.brand || !selectedBrands.includes(p.brand)) {
        return false;
      }
    }

    // Price filter only — bands from commerce-content (live currency symbol)
    const selectedPrices = activeFilters["Price"] ?? [];
    if (selectedPrices.length > 0) {
      const priceVal = p.pricePesewas / 100;
      const bands = plpPriceBandMatchers();
      const matchesPrice = selectedPrices.some((range) => {
        const band = bands.find((b) => b.label === range);
        return band ? band.test(priceVal) : true;
      });
      if (!matchesPrice) return false;
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
    <ShopPage dense className="space-y-4 md:space-y-5">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/" className="text-link">
                Home
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-semibold text-foreground">{categoryLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Quiet PLP header — title + count (Ghana marketplace) */}
      <div className="flex flex-col gap-1 border-b border-border pb-3">
        <p className="text-eyebrow">{isSearch ? "Search results" : "Shop"}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {categoryLabel}{" "}
            <span className="text-base font-semibold tabular-nums text-muted-foreground">
              ({total.toLocaleString()} items)
            </span>
          </h1>
          <p className="text-meta max-w-xs text-right">
            Prices in GHS. Delivery &amp; MoMo options confirmed at checkout.
          </p>
        </div>
      </div>

      {/* Quick refine chips + sort toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {PLP_QUICK_FILTERS.map((p) => (
            <Link key={p.label} to="/browse/$slug" params={{ slug: p.value }}>
              <PillChip active={slug === p.value}>{p.label}</PillChip>
            </Link>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          <span className="font-medium text-muted-foreground">Sort by</span>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="h-9 w-44 rounded-full border-border bg-card">
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

      <div className="grid gap-5 lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr]">
        {/* Sticky white facet card on gray canvas */}
        <aside className="lg:sticky lg:top-28 lg:h-max">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight text-foreground">Filters</h2>
              <button
                type="button"
                onClick={() => setActiveFilters({})}
                className="text-xs font-bold text-link hover:underline"
              >
                Clear all
              </button>
            </div>
            <input
              type="search"
              aria-label="Search filters"
              placeholder="Search filters"
              className="mb-3 h-9 w-full rounded-full border border-input bg-background px-4 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Accordion type="multiple" defaultValue={["Price", "Brand", "Fulfillment"]} className="w-full">
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
        <div className="min-w-0">
          {showLoading ? (
            <ProductCardSkeletonGrid count={12} />
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
              <p className="text-lg font-bold text-foreground">
                {isSearch ? "No results found" : "No products here yet"}
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {isSearch
                  ? `We couldn't find anything matching "${search.search ?? ""}". Try fewer words or a different spelling.`
                  : "Sellers are still listing in this category. Try another department or check back soon."}
              </p>
              <Link
                to="/"
                className="mt-1 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
              >
                Continue shopping
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  brand={p.brand}
                  vendorName={p.vendor?.name}
                  vendorSlug={p.vendor?.slug}
                  tag={(p.tag as "rollback" | "clearance" | "best" | "popular" | "new" | null) ?? undefined}
                  now={pesewasToPrice(p.pricePesewas)}
                  was={p.compareAtPesewas ? pesewasToPrice(p.compareAtPesewas) : undefined}
                  rating={p.ratingCount > 0 ? p.ratingAvgX100 / 100 : undefined}
                  reviews={p.ratingCount > 0 ? p.ratingCount : undefined}
                  stock={typeof p.stock === "number" ? p.stock : undefined}
                  imageUrl={p.imageUrl}
                  showAdd
                  showOptions={false}
                  showShipping
                  shippingLabel="Delivery options at checkout"
                  emphasis={p.tag === "rollback" ? "deal" : "default"}
                  onAdd={() => {
                    if (!p.offerId && !p.variantId) {
                      console.error("Product has no purchasable offer/variant", p.id);
                      return;
                    }
                    addCartItem.mutate({
                      data: {
                        offerId: p.offerId,
                        variantId: p.variantId,
                        qty: 1,
                      },
                    });
                  }}
                  addPending={addCartItem.isPending}
                />
              ))}
            </div>
          )}

          {!showLoading && products.length > 0 && (
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
    </ShopPage>
  );
}
