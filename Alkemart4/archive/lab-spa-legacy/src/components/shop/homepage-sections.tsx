import { useListProducts, useListCategories } from "@/lib/hooks-products";
import { SITE_DEPARTMENTS, labelToSlug } from "@/lib/commerce-content";
import type { RailProduct } from "./product-rail";

type HomepageSectionType =
  | "announcement_yellow"
  | "hero"
  | "product_rail"
  | "feature_grid"
  | "deals_grid"
  | "category_row"
  | "bento_grid"
  | "video_grid"
  | "hero_split"
  | "express_band"
  | "seller_cta";

interface HomepageSection {
  id: number;
  type: HomepageSectionType;
  sortOrder: number;
  enabled: boolean;
  config: Record<string, unknown>;
  imageUrl?: string | null;
}

interface Category {
  id: string;
  slug: string;
  name: string;
}
import { SectionHeader } from "./section-header";
import { ProductRail } from "./product-rail";
import { FeatureTile } from "./feature-tile";
import { MiniDealsColumn } from "./mini-deals-column";
import { CategoryTile } from "./category-tile";
import { BentoCard } from "./bento-card";
import { DiscoveryHero } from "./discovery-hero";
import { HeroSplit } from "./hero-split";
import { ExpressDeliveryBand } from "./express-delivery-band";
import { AnnouncementYellow } from "./announcement-yellow";
import { SellerCtaBand } from "./seller-cta-band";
import { resolveThemeColors } from "@/lib/homepage-themes";

type ProductTag = "rollback" | "clearance" | "best" | "popular" | "new";

interface SectionProps {
  config: Record<string, unknown>;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function tag(value: unknown): ProductTag | undefined {
  return typeof value === "string" ? (value as ProductTag) : undefined;
}

function AnnouncementYellowSection({ config }: SectionProps) {
  return (
    <AnnouncementYellow
      headline={str(config.headline)}
      cta={str(config.cta)}
      ctaTo={str(config.ctaTo) ?? "/browse/all"}
    />
  );
}

function HeroSection({ config }: SectionProps) {
  return (
    <DiscoveryHero
      eyebrow={str(config.eyebrow)}
      title={str(config.title)}
      subtitle={str(config.subtitle)}
      cta={str(config.cta)}
      ctaTo={str(config.ctaTo) ?? "/browse/all"}
      imageUrl={str(config.imageUrl)}
    />
  );
}

function RealProductRail({ config }: SectionProps) {
  const title = str(config.title);
  const linkTo = str(config.linkTo) ?? "/browse/$slug";
  const railTag = tag(config.tag);
  const count = num(config.count) ?? 6;
  const columns = num(config.columns) ?? 6;
  const showAdd = Boolean(config.showAdd);
  const { data, isLoading, isError } = useListProducts({
    tag: railTag,
    limit: count,
  });

  const items = data?.items ?? [];
  const loading = isLoading && !isError;
  // Collapse empty rails so the home page is not two identical empty bands.
  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <section>
      {title && <SectionHeader title={title} linkTo={linkTo} />}
      <ProductRail
        count={count}
        columns={columns}
        tag={railTag}
        showAdd={showAdd}
        products={items}
        loading={loading}
        emptyLabel="No products in this section yet. Ghana sellers are still listing."
      />
    </section>
  );
}

/** Single honest empty band when the whole catalog is empty (after rails collapse). */
export function CatalogEmptyHint() {
  return (
    <section className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
      <p className="text-base font-bold text-foreground">Sellers are still listing</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        New Ghana vendors are adding products. Browse departments or check back soon —
        prices stay in GHS with MoMo at checkout.
      </p>
      <a
        href="/browse/all"
        className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
      >
        Browse all
      </a>
    </section>
  );
}

function ProductRailSection({ config }: SectionProps) {
  // Always load real catalog data — never render mock priced rails in production UI.
  // `useRealData: false` is treated as loading live products (legacy admin flag ignored).
  return <RealProductRail config={config} />;
}

function FeatureGridSection({ config }: SectionProps) {
  const configItems =
    Array.isArray(config.items) && config.items.length > 0
      ? (config.items as { id: string; icon?: string; title: string; description?: string }[])
      : [];

  if (configItems.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Trust and feature tiles will appear when configured.
      </section>
    );
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {configItems.map((item) => (
        <FeatureTile
          key={item.id}
          tone="surface"
          eyebrow={item.icon}
          title={item.title}
          body={item.description}
          layout="stacked"
          showImage={false}
        />
      ))}
    </section>
  );
}

/** Ghana-friendly deal column labels (tags still map to catalog filters). */
const dealColumns = [
  { title: "Market deals", tone: "surface" as const, tag: "rollback" as const },
  { title: "Clearance picks", tone: "secondary" as const, tag: "clearance" as const },
  { title: "Top sellers", tone: "surface" as const, tag: "best" as const },
  { title: "Popular right now", tone: "muted" as const, tag: "popular" as const },
  { title: "New on alkemart", tone: "surface" as const, tag: "new" as const },
];

function DealsColumn({ title, tone, tag }: (typeof dealColumns)[number]) {
  const { data, isLoading } = useListProducts({ tag, limit: 4 });
  return (
    <MiniDealsColumn
      title={title}
      tone={tone}
      tag={tag}
      products={isLoading ? undefined : (data?.items ?? [])}
    />
  );
}

function DealsGridSection({ config }: SectionProps) {
  const configTag = tag(config.tag);
  const count = num(config.count) ?? 4;
  const columns = num(config.columns) ?? 5;
  const showAdd = Boolean(config.showAdd);
  const title = str(config.title);

  // Always call the hook; pass tag only when configured.
  const { data, isLoading } = useListProducts(
    configTag ? { tag: configTag, limit: count } : undefined,
  );

  // When a tag is configured, render a focused product rail instead of the
  // default 5-column deal layout.
  if (configTag) {
    return (
      <section>
        {title && <SectionHeader title={title} />}
        <ProductRail
          count={count}
          columns={columns}
          tag={configTag}
          showAdd={showAdd}
          products={data?.items}
          loading={isLoading}
        />
      </section>
    );
  }

  return (
    <section>
      {title && <SectionHeader title={title} />}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {dealColumns.map((c) => (
          <DealsColumn key={c.title} {...c} />
        ))}
      </div>
    </section>
  );
}

function CategoryRowSection({ config }: SectionProps) {
  const title = str(config.title) ?? "Shop by category";
  const linkTo = str(config.linkTo) ?? "/browse/all";
  const pinnedIds =
    Array.isArray(config.categoryIds) && config.categoryIds.length > 0
      ? (config.categoryIds as Array<string | number>).map(String)
      : null;

  const { data: categoryData, isLoading, isError } = useListCategories();
  const list = Array.isArray(categoryData) ? categoryData : [];

  const apiTiles =
    pinnedIds !== null
      ? list.filter((c) => pinnedIds.includes(String(c.id)))
      : list.slice(0, 16);

  /** Local taxonomy when catalog categories are not seeded yet (Ghana IA). */
  const fallbackTiles = SITE_DEPARTMENTS.filter((d) => d !== "Deals").map((label) => ({
    id: `fallback-${labelToSlug(label)}`,
    name: label,
    slug: labelToSlug(label),
  }));

  const tiles =
    apiTiles.length > 0
      ? apiTiles.map((c) => ({ id: String(c.id), name: c.name, slug: c.slug }))
      : !isLoading || isError
        ? fallbackTiles
        : [];

  return (
    <section>
      <SectionHeader title={title} linkTo={linkTo} />
      {isLoading && !isError && tiles.length === 0 ? (
        <div className="grid grid-cols-4 gap-4 md:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 md:grid-cols-8">
          {tiles.map((c) => (
            <CategoryTile key={c.id} label={c.name} slug={c.slug} imageTone="brand" />
          ))}
        </div>
      )}
    </section>
  );
}

/** Department tiles for bento — Ghana marketplace navigation. */
const BENTO_DEPARTMENTS = [
  { title: "Grocery & essentials", eyebrow: "Grocery", slug: "grocery" },
  { title: "Phones & gadgets", eyebrow: "Phones", slug: "phones" },
  { title: "Beauty & personal care", eyebrow: "Beauty", slug: "beauty" },
  { title: "Fashion for everyone", eyebrow: "Fashion", slug: "fashion" },
] as const;

function BentoGridSection({ config }: SectionProps) {
  const { bg: themeBg, fg: themeFg } = resolveThemeColors(
    str(config.theme),
    str(config.customBg),
    str(config.customFg),
  );

  if (config.variant === "with_rail") {
    const railTitle = str(config.railTitle) ?? "Today’s market";
    const railLinkTo = str(config.railLinkTo) ?? "/browse/all";
    const railCount = num(config.railCount) ?? 4;
    const railColumns = num(config.railColumns) ?? 4;
    const showAdd = Boolean(config.showAdd);
    const { data, isLoading, isError } = useListProducts(
      { limit: railCount },
      { query: { retry: false, throwOnError: false } },
    );

    return (
      <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <BentoCard
          size="lg"
          tone="secondary"
          eyebrow="alkemart Ghana"
          title={str(config.title) ?? "Shop local vendors"}
          cta={str(config.cta) ?? "Browse the market"}
          ctaTo={str(config.ctaTo) ?? "/browse/all"}
          imageRatio={4 / 3}
          imageTone="brand"
          themeBg={themeBg}
          themeFg={themeFg}
        />
        <div>
          <SectionHeader title={railTitle} linkTo={railLinkTo} />
          <ProductRail
            count={railCount}
            columns={railColumns}
            showAdd={showAdd}
            products={data?.items ?? []}
            loading={isLoading && !isError}
            emptyLabel="No products in this rail yet. Sellers are still listing."
          />
        </div>
      </section>
    );
  }

  const ctaTo = str(config.ctaTo) ?? "/browse/all";
  const cta = str(config.cta) ?? "Shop now";

  return (
    <section className="grid gap-4 md:grid-cols-4">
      <BentoCard
        size="lg"
        tone="secondary"
        eyebrow="alkemart Ghana"
        title={str(config.title) ?? "Explore the marketplace"}
        cta={cta}
        ctaTo={ctaTo}
        className="md:col-span-2 md:row-span-2"
        imageRatio={16 / 9}
        imageTone="brand"
        themeBg={themeBg}
        themeFg={themeFg}
      />
      {BENTO_DEPARTMENTS.map((c) => (
        <BentoCard
          key={c.slug}
          size="md"
          tone="muted"
          eyebrow={c.eyebrow}
          title={c.title}
          cta={cta}
          ctaTo={`/browse/${c.slug}`}
          imageRatio={4 / 3}
          imageTone="default"
          themeBg={themeBg}
          themeFg={themeFg}
        />
      ))}
    </section>
  );
}

function VideoGridSection({ config }: SectionProps) {
  const title = str(config.title) ?? "Stories from the market";
  const linkTo = str(config.linkTo) ?? "/browse/all";

  // No video CMS yet — honest empty instead of fake handles/prices
  return (
    <section>
      <SectionHeader title={title} linkTo={linkTo} />
      <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Video content will appear here when configured.
      </div>
    </section>
  );
}

function HeroSplitSection({ config }: SectionProps) {
  const layout = str(config.layout) ?? "hero_first";
  const heroTone = (str(config.heroTone) ?? "surface-strong") as
    | "surface"
    | "surface-strong"
    | "muted"
    | "secondary"
    | "primary"
    | "accent";
  const heroImagePosition = (str(config.heroImagePosition) ?? "right") as "left" | "right";
  const { bg: themeBg, fg: themeFg } = resolveThemeColors(
    str(config.theme),
    str(config.customBg),
    str(config.customFg),
  );

  const heroEl = (
    <HeroSplit
      tone={heroTone}
      eyebrow={str(config.heroEyebrow)}
      title={str(config.heroTitle) ?? ""}
      cta={str(config.heroCta)}
      ctaTo={str(config.heroCtaTo) ?? "/browse/all"}
      imagePosition={heroImagePosition}
      themeBg={themeBg}
      themeFg={themeFg}
      imageUrl={str(config.imageUrl)}
    />
  );

  const railEl = (
    <div>
      <SectionHeader
        title={str(config.railTitle) ?? ""}
        eyebrow={str(config.railEyebrow)}
        linkTo={str(config.railLinkTo) ?? "/browse/all"}
      />
      <ProductRail
        count={num(config.railCount) ?? 3}
        columns={num(config.railColumns) ?? 3}
        tag={tag(config.railTag)}
        showAdd={Boolean(config.showAdd)}
        products={[]}
        emptyLabel="No products in this rail yet."
      />
    </div>
  );

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {layout === "hero_first" ? (
        <>
          {heroEl}
          {railEl}
        </>
      ) : (
        <>
          {railEl}
          {heroEl}
        </>
      )}
    </section>
  );
}

function ExpressBandSection({ config }: SectionProps) {
  return (
    <ExpressDeliveryBand
      headline={str(config.headline)}
      subtext={str(config.subtext)}
    />
  );
}

function SellerCtaSection({ config }: SectionProps) {
  return (
    <SellerCtaBand
      eyebrow={str(config.eyebrow)}
      title={str(config.title)}
      body={str(config.body)}
      cta={str(config.cta)}
    />
  );
}

const SECTION_REGISTRY: Record<
  HomepageSectionType,
  (props: SectionProps) => React.JSX.Element | null
> = {
  announcement_yellow: AnnouncementYellowSection,
  hero: HeroSection,
  product_rail: ProductRailSection,
  feature_grid: FeatureGridSection,
  deals_grid: DealsGridSection,
  category_row: CategoryRowSection,
  bento_grid: BentoGridSection,
  video_grid: VideoGridSection,
  hero_split: HeroSplitSection,
  express_band: ExpressBandSection,
  seller_cta: SellerCtaSection,
};

/**
 * Renders the ordered, filtered list of homepage sections.
 * Dispatches each section's `type` to its registered component.
 * Unknown types are skipped so older clients degrade gracefully.
 */
export function HomepageSectionList({ sections }: { sections: HomepageSection[] }) {
  // Honest empty state — never invent priced product placeholders
  if (!sections.length) {
    return (
      <div className="shop-section gap-5">
        <div className="shop-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <h2 className="text-section-title">alkemart Ghana is ready</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Homepage modules will appear once configured. Browse departments from the header,
            or wait for Ghana sellers to list products.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <a
              href="/browse/all"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
            >
              Browse all
            </a>
          </div>
        </div>
        {/* Structure-only skeleton — no prices or fake products */}
        <div className="shop-card space-y-3 p-4" aria-hidden>
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="aspect-square animate-pulse rounded-md bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {sections.map((section) => {
        const Component = SECTION_REGISTRY[section.type];
        if (!Component) return null;
        return (
          <div key={section.id} className="shop-section">
            <Component config={section.config} />
          </div>
        );
      })}
    </div>
  );
}
