import type {
  CategoryBannerTile,
  HomeSection,
} from "@alkemart/shared/homepage";
import { Fragment } from "react";
import {
  categoryRatioOf,
  categoryTilesOf,
  visibleSections,
} from "@alkemart/shared/homepage";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MerchCategoryTileBody,
  MerchCountdownBanner,
  MerchDealBadge,
  MerchDealRail,
  MerchEmpty,
  MerchGridSection,
  MerchMarquee,
  MerchPromoBand,
  MerchPromoGrid,
  MerchPromoHero,
  MerchShelf,
  MerchValueGrid,
  merchCategoryTileClass,
} from "@workspace/ui";
import { ProductCard } from "@/components/product-card";
import { ProductGridShell } from "@/components/product-grid";
import { ProductCardSkeleton, ShelfSkeleton } from "@/components/skeleton";
import { IconSafe } from "@/design/icons";
import {
  iconForCategory,
  metaFor,
  RAIL_DEPARTMENT_ORDER,
} from "@/lib/catalog-nav";
import {
  listStoreProducts,
  type StoreCategory,
  type StoreProductCard,
} from "@/lib/products";
import { useShelfSource } from "@/components/home/useShelfSource";
import { StoreRail } from "@/components/home/StoreRail";
import { CategoryMosaic } from "@/components/home/CategoryMosaic";
import { DealsOfTheDay } from "@/components/home/DealsOfTheDay";
import { HomeLastOffers } from "@/components/home/HomeLastOffers";
import { HomeAdvertiseBand } from "@/components/home/HomeAdvertiseBand";
import { HomePopularRail } from "@/components/home/HomePopularRail";
import { HomeFeaturedShop } from "@/components/home/HomeFeaturedShop";
import { HomeCategoryRail } from "@/components/home/HomeCategoryRail";
import { HomeMarketPromise } from "@/components/home/HomeMarketPromise";
import { StudioSection } from "@/components/home/StudioSection";
import { useStudioEditClass } from "@/lib/studio-edit";
import { resolveMosaicTiles } from "@/lib/catalog-nav";
import type { CourseShelf } from "@/lib/course";

type Props = {
  sections: HomeSection[];
  categories: StoreCategory[];
  products: StoreProductCard[];
  /** The page's featured list is still in flight — shelves shimmer, not fake. */
  productsLoading?: boolean;
  /** Rule-backed course shelves (Phase 5C). They render as beats directly
   *  beneath the departments mosaic and claim products through the same
   *  distinctness pipeline as every other rail. */
  courseShelves?: CourseShelf[];
};

export function HomepageSections({
  sections,
  categories,
  products,
  productsLoading,
  courseShelves = [],
}: Props) {
  useStudioEditClass();
  const live = visibleSections(sections);
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );

  /**
   * A product already shown in a beat above must not reappear below — the
   * "same six products in every shelf" effect. The catalogue is small early
   * on, so beats that cannot stay distinct collapse instead of repeating.
   */
  const seen = new Set<string>();
  const takeUnseen = (
    list: StoreProductCard[],
    max: number,
  ): StoreProductCard[] => {
    const fresh: StoreProductCard[] = [];
    for (const product of list) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      fresh.push(product);
      if (fresh.length >= max) break;
    }
    return fresh;
  };

  const desktopDecisionId = live.find(
    (section) =>
      section.type === "product_shelf" || section.type === "deal_rail",
  )?.id;
  const decisionShelfId = live.find(
    (section) => section.type === "product_shelf",
  )?.id;
  const desktopPromoBand = live.find(
    (section): section is Extract<HomeSection, { type: "promo_band" }> =>
      section.type === "promo_band",
  );
  const desktopStoreRail = live.find(
    (section): section is Extract<HomeSection, { type: "store_rail" }> =>
      section.type === "store_rail",
  );

  /**
   * Rule-backed course shelves sit directly beneath the departments mosaic:
   * the art-led entry stays first, merchandised drops follow, and the
   * comparison layer keeps its place. Cards claim through the same
   * distinctness pipeline; a shelf left with nothing collapses.
   */
  const renderCourseShelves = () =>
    courseShelves.flatMap((shelf) => {
      const cards = takeUnseen(shelf.cards, 8);
      if (!cards.length && !productsLoading) return [];
      const shelfId = `course-${shelf.key}`;
      const shelfBody = (
        <>
          <h2 className="type-section text-foreground">{shelf.title}</h2>
          {productsLoading && !cards.length ? (
            <ShelfSkeleton count={4} />
          ) : (
            <ProductGridShell className="lg:grid-cols-5 lg:gap-3">
              {cards.map((product) => (
                <ProductCard key={product.id} product={product} size="tile" hideSellerCount className="max-w-none" />
              ))}
            </ProductGridShell>
          )}
        </>
      );
      return [
        <section key={shelfId} aria-label={shelf.title} className="space-y-3">
          <StudioSection id={shelfId} label={shelf.title}>
            {shelfBody}
          </StudioSection>
        </section>,
      ];
    });

  let courseInjected = false;

  return (
    <div className="space-y-8 sm:space-y-12">
      {live.map((section) => {
        let content: React.ReactNode = null;
        if (section.type === "promo_hero")
          content = (
            <MerchPromoHero
              key={section.id}
              {...section}
              layout={section.layout ?? "split"}
            />
          );
        else if (section.type === "promo_grid")
          content = (
            <MerchPromoGrid
              key={section.id}
              {...section}
              variant={section.variant ?? "cards"}
            />
          );
        else if (section.type === "promo_band")
          content = <MerchPromoBand key={section.id} {...section} />;
        else if (section.type === "countdown_banner")
          content = <MerchCountdownBanner key={section.id} {...section} />;
        else if (section.type === "marquee")
          content = <MerchMarquee key={section.id} {...section} />;
        else if (section.type === "deal_rail") {
          const dealCategory = section.categoryId
            ? categoryById.get(section.categoryId)
            : undefined;
          content =
            section.variant === "tabs" ? (
              <DealsOfTheDay
                key={section.id}
                section={section}
                category={dealCategory}
                categories={categories}
                featured={products}
                featuredLoading={productsLoading}
                claim={takeUnseen}
              />
            ) : (
              <DealRail
                key={section.id}
                section={section}
                category={dealCategory}
                featured={products}
              />
            );
        } else if (section.type === "category_grid") {
          if (
            section.variant === "mosaic" ||
            section.id === "departments-mosaic" ||
            section.id === "categories"
          ) {
            const mosaicTiles = resolveMosaicTiles(categories);
            content = <CategoryMosaic key={section.id} tiles={mosaicTiles} />;
          } else {
            content = (
              <CategoryBanners
                key={section.id}
                section={section}
                categoryById={categoryById}
                categories={categories}
              />
            );
          }
        } else if (section.type === "product_shelf") {
          if (section.id === decisionShelfId) {
            // The decision beat is the comparison layer, not another rail:
            // it always shows the full featured set with its tabs and sort.
            // Rails below stay distinct through takeUnseen.
            content = (
              <HomeLastOffers
                key={section.id}
                products={products}
                categories={categories}
                loading={productsLoading}
              />
            );
          } else {
            const shelfCategory = section.categoryId
              ? categoryById.get(section.categoryId)
              : undefined;
            content = (
              <ManagedProductShelf
                key={section.id}
                section={section}
                category={shelfCategory}
                categories={categories}
                featured={products}
                featuredLoading={productsLoading}
                claim={takeUnseen}
              />
            );
          }
        } else if (section.type === "store_rail")
          content = <StoreRail key={section.id} section={section} />;
        else
          content = (
            <MerchValueGrid
              key={section.id}
              title={section.title}
              subtitle={section.subtitle}
              items={section.items}
            />
          );

        const desktopPrimary =
          section.type === "category_grid" || section.id === desktopDecisionId;

        // Course shelves attach beneath the departments mosaic, wherever it sits.
        const injectCourse =
          !courseInjected && section.type === "category_grid" && courseShelves.length > 0;
        if (section.type === "category_grid") courseInjected = true;

        return (
          <Fragment key={section.id}>
            {section.id === desktopDecisionId && desktopPromoBand ? (
              <div className="hidden lg:block">
                <MerchPromoBand {...desktopPromoBand} />
              </div>
            ) : null}
            <div className={desktopPrimary ? undefined : "lg:hidden"}>
              <StudioSection
                id={section.id}
                label={"title" in section && section.title ? section.title : section.id}
              >
                {content}
              </StudioSection>
            </div>
            {injectCourse ? renderCourseShelves() : null}
          </Fragment>
        );
      })}
      <HomeMarketPromise />
      <HomePopularRail products={products} />
      <HomeFeaturedShop products={products} />
      {desktopStoreRail ? (
        <div className="hidden lg:block">
          <StoreRail
            section={{ ...desktopStoreRail, layout: "carousel", limit: 8 }}
          />
        </div>
      ) : null}
      <HomeCategoryRail categories={categories} />
      <HomeAdvertiseBand />
    </div>
  );
}

/**
 * Category banners — the studio-driven successor to the hand-built mosaic.
 *
 * Each tile is a banner: admin-chosen art (falling back to the canonical
 * category photography), an optional crop, and a caption below the image.
 * Layout and proportions come from the section, so the same component covers
 * the mosaic hierarchy, an even tile grid, a scroll rail, and wide strips.
 */
function CategoryBanners({
  section,
  categoryById,
  categories,
}: {
  section: Extract<HomeSection, { type: "category_grid" }>;
  categoryById: Map<string, StoreCategory>;
  categories: StoreCategory[];
}) {
  const variant = section.variant ?? "tiles";
  const ratio = categoryRatioOf(section);
  type ResolvedTile = { tile: CategoryBannerTile; category: StoreCategory };
  const configured: ResolvedTile[] = categoryTilesOf(section)
    .map((tile) => ({ tile, category: categoryById.get(tile.categoryId) }))
    .filter((entry): entry is ResolvedTile => Boolean(entry.category));

  const rank = (handle?: string | null) => {
    const i = (RAIL_DEPARTMENT_ORDER as readonly string[]).indexOf(
      (handle ?? "").toLowerCase(),
    );
    return i === -1 ? 99 : i;
  };

  // Nothing configured yet: goods-first departments, never API rank (food first).
  const entries: ResolvedTile[] = configured.length
    ? configured
    : categories
        .filter((category) => !category.parentCategoryId)
        .slice()
        .sort((a, b) => rank(a.handle) - rank(b.handle))
        .slice(0, variant === "mosaic" ? 4 : section.columns)
        .map((category, index) => ({
          tile: {
            categoryId: category.id,
            slot: index < 2 ? ("feature" as const) : ("standard" as const),
          },
          category,
        }));

  const limit = variant === "mosaic" ? 4 : 16;
  const shown = entries.slice(0, limit);

  if (!shown.length) {
    return (
      <MerchEmpty
        title={section.title}
        body={
          section.subtitle ??
          "Categories will appear here once the catalogue is linked."
        }
      />
    );
  }

  const action =
    section.showAllLink === false ? undefined : (
      <Link
        to="/categories/$slug"
        params={{ slug: "all" }}
        className="text-sm font-bold hover:underline"
      >
        View all
      </Link>
    );

  return (
    <MerchGridSection
      title={section.title}
      subtitle={section.subtitle}
      columns={section.columns}
      variant={variant}
      action={action}
    >
      {shown.map(({ tile, category }, index) => {
        // Mosaic keeps its two-large / two-small composition even when an
        // admin has not marked slots, matching the original homepage design.
        const feature = tile.slot
          ? tile.slot === "feature"
          : variant === "mosaic" && index < 2;
        const label = tile.label || category.name;
        const photo = tile.imageUrl || metaFor(category.handle)?.mosaic?.photo;
        return (
          <Link
            key={`${section.id}-${category.id}`}
            to="/categories/$slug"
            params={{ slug: category.handle || category.id }}
            aria-label={`Browse ${label}`}
            role={variant === "rail" ? "listitem" : undefined}
            className={merchCategoryTileClass({ variant, ratio, feature })}
          >
            <MerchCategoryTileBody
              label={label}
              badge={tile.badge}
              imageUrl={photo}
              focalPoint={tile.focalPoint}
              imageClassName={metaFor(category.handle)?.mosaic?.objectPos}
              feature={feature}
              variant={variant}
              ratio={ratio}
              fallback={
                <IconSafe
                  name={iconForCategory(category.name, category.handle)}
                  size={feature ? 64 : 44}
                  preferAsset
                />
              }
            />
          </Link>
        );
      })}
    </MerchGridSection>
  );
}

/**
 * Deal rail — campaign framing around real products.
 *
 * Deliberately shows no "% off" or stock meter: the catalogue carries no
 * compare-at price or inventory count, and inventing either would be a claim
 * we cannot substantiate. The urgency comes from the admin's badge and clock,
 * both of which are real.
 */
function DealRail({
  section,
  category,
  featured,
}: {
  section: Extract<HomeSection, { type: "deal_rail" }>;
  category?: StoreCategory;
  featured: StoreProductCard[];
}) {
  const liveQ = useQuery({
    queryKey: [
      "store",
      "homepage-deals",
      section.source,
      category?.id ?? "all",
      section.limit,
    ],
    queryFn: () =>
      listStoreProducts({
        limit: section.limit,
        sort: "newest",
        ...(category
          ? {
              categoryId: category.id,
              categoryHandle: category.handle || undefined,
            }
          : {}),
      }),
    enabled:
      (section.source === "latest" || section.source === "category") &&
      (section.source !== "category" || Boolean(category)),
    staleTime: 120_000,
  });

  let products: StoreProductCard[] = [];
  if (section.source === "manual") {
    const byId = new Map(featured.map((product) => [product.id, product]));
    products = (section.productIds ?? [])
      .map((id) => byId.get(id))
      .filter((product): product is StoreProductCard => Boolean(product));
  } else if (section.source === "featured") {
    products = featured.slice(0, section.limit);
  } else {
    products = liveQ.data?.products ?? [];
  }

  if (section.source === "category" && !category) {
    return (
      <MerchEmpty
        title={section.title}
        body="The linked category is no longer in the catalogue. Pick another category in Homepage Studio."
      />
    );
  }
  if (!products.length) {
    if (liveQ.isLoading) {
      return (
        <MerchDealRail
          title={section.title}
          subtitle={section.subtitle}
          eyebrow={section.eyebrow}
          countdownTo={section.countdownTo}
        >
          {Array.from({ length: Math.min(section.limit, 4) }).map(
            (_, index) => (
              <div
                key={index}
                className="w-[calc((100vw-3.25rem)/2)] max-w-[224px] shrink-0 sm:w-56"
              >
                <ProductCardSkeleton />
              </div>
            ),
          )}
        </MerchDealRail>
      );
    }
    return (
      <MerchEmpty
        title={section.title}
        body="No live products match this deal yet."
      />
    );
  }

  return (
    <MerchDealRail
      title={section.title}
      subtitle={section.subtitle}
      eyebrow={section.eyebrow}
      countdownTo={section.countdownTo}
    >
      {products.slice(0, section.limit).map((product) => (
        <div
          key={product.id}
          className="relative w-[calc((100vw-3.25rem)/2)] max-w-[224px] shrink-0 snap-start sm:w-56"
        >
          {section.badge ? <MerchDealBadge label={section.badge} /> : null}
          <ProductCard product={product} size="tile" />
        </div>
      ))}
    </MerchDealRail>
  );
}

export type ClaimProducts = (
  list: StoreProductCard[],
  max: number,
) => StoreProductCard[];

function ProductShelf({
  id,
  title,
  subtitle,
  layout = "carousel",
  action,
  products,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  layout?: "grid" | "carousel";
  action?: React.ReactNode;
  products: StoreProductCard[];
}) {
  if (products.length < 4) return null;
  const isMostOrdered =
    id === "most-ordered" ||
    title.toLowerCase().includes("ordered") ||
    title.toLowerCase().includes("deals");
  if (layout === "carousel" || isMostOrdered) {
    return (
      <MerchShelf
        title={title}
        subtitle={subtitle}
        layout="carousel"
        action={action}
      >
        {isMostOrdered ? (
          <div className="group relative flex aspect-square sm:aspect-[4/3] w-52 sm:w-60 shrink-0 snap-start flex-col overflow-hidden rounded-lg ring-1 ring-black/[0.06] shadow-xs">
            <div className="relative h-3/5 w-full overflow-hidden bg-muted">
              <img
                src="/images/categories/food.webp"
                alt=""
                className="h-full w-full object-cover"
              />
              <span className="absolute top-2.5 left-2.5 rounded-[6px] bg-primary px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary-foreground shadow-xs">
                Express Rider
              </span>
            </div>
            <div className="flex h-2/5 flex-col justify-center bg-card dark:bg-muted/40 px-3.5 py-2">
              <p className="text-xs sm:text-sm font-bold uppercase leading-tight text-foreground">
                More Freedom With Each Delivery
              </p>
              <p className="text-xs font-medium text-muted-foreground truncate">
                Fast doorstep dispatch across Ghana
              </p>
            </div>
          </div>
        ) : null}
        {products.map((product) => (
          <div
            key={product.id}
            className="w-[calc((100vw-3.25rem)/2)] max-w-[224px] shrink-0 snap-start sm:w-56"
          >
            <ProductCard product={product} size="store" />
          </div>
        ))}
      </MerchShelf>
    );
  }
  return (
    <MerchShelf title={title} subtitle={subtitle} action={action}>
      <ProductGridShell>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} size="store" />
        ))}
      </ProductGridShell>
    </MerchShelf>
  );
}

function ManagedProductShelf({
  section,
  category,
  categories,
  featured,
  featuredLoading,
  claim,
}: {
  section: Extract<HomeSection, { type: "product_shelf" }>;
  category?: StoreCategory;
  categories?: StoreCategory[];
  featured: StoreProductCard[];
  featuredLoading?: boolean;
  claim?: ClaimProducts;
}) {
  const resolved = useShelfSource({
    source: section.source,
    limit: section.limit,
    category,
    categories,
    featured,
    featuredLoading,
    productIds: section.productIds,
    daypartCategoryIds: section.daypartCategoryIds,
    scope: `shelf:${section.id}`,
  });

  // A daypart shelf names itself from the buyer's clock, so the configured
  // title is a fallback rather than the heading.
  const title = resolved.titleOverride ?? section.title;
  const layout = section.layout ?? "carousel";

  // A shelf that fails to resolve still shows its heading — dropping the whole
  // section would make the page look like it lost a beat.
  const action =
    section.showAllLink === false ? undefined : (
      <Link
        to="/categories/$slug"
        params={{ slug: category?.handle || "all" }}
        className="text-sm font-bold hover:underline"
      >
        View more
      </Link>
    );

  if (resolved.loading) {
    return <ShelfSkeleton count={Math.min(section.limit, 5)} layout={layout} />;
  }
  if (section.source === "category" && !category) {
    return (
      <MerchEmpty
        title={title}
        body="The linked category is no longer in the catalogue. Pick another category in Homepage Studio."
      />
    );
  }
  const resolvedProducts =
    section.id === "compare-price"
      ? resolved.products.filter((product) => (product.offerCount ?? 0) > 1)
      : resolved.products;

  // Prefer cards no beat above has shown; fall back to the shelf's own slice
  // when a young catalogue cannot keep every beat distinct. A collapsed beat
  // breaks the page's rhythm and reads as a bug — repetition under a different
  // lens (rank, freshness) is how small catalogues survive a marketing course.
  const fresh = claim ? claim(resolvedProducts, section.limit) : [];
  const products =
    fresh.length >= 4 ? fresh : resolvedProducts.slice(0, section.limit);

  // An empty beat collapses. "No buyer has reviewed an order yet" is true
  // and useless in the middle of a marketing course — the buyer can't act on
  // it. (Studio previews render the explanation instead; this is the buyer
  // surface.) A misconfigured category link stays visible, because that one
  // is admin-actionable.
  if (products.length < 4) return null;
  return (
    <ProductShelf
      id={section.id}
      title={title}
      subtitle={section.subtitle}
      layout={layout}
      action={action}
      products={products}
    />
  );
}
