import { useListProducts } from "@workspace/api-client-react";
import type { HomepageSection, HomepageSectionType } from "@workspace/api-client-react";
import { SectionHeader } from "./section-header";
import { ProductRail } from "./product-rail";
import { FeatureTile } from "./feature-tile";
import { MiniDealsColumn } from "./mini-deals-column";
import { CategoryTile } from "./category-tile";
import { VideoCard } from "./video-card";
import { BentoCard } from "./bento-card";
import { DiscoveryHero } from "./discovery-hero";
import { HeroSplit } from "./hero-split";
import { ExpressDeliveryBand } from "./express-delivery-band";
import { AnnouncementYellow } from "./announcement-yellow";
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

function AnnouncementYellowSection() {
  return <AnnouncementYellow />;
}

function HeroSection({ config }: SectionProps) {
  return (
    <DiscoveryHero
      eyebrow={str(config.eyebrow)}
      title={str(config.title)}
      cta={str(config.cta)}
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
  const { data, isLoading } = useListProducts({ tag: railTag, limit: count });

  return (
    <section>
      {title && <SectionHeader title={title} linkTo={linkTo} />}
      <ProductRail
        count={count}
        columns={columns}
        tag={railTag}
        showAdd={showAdd}
        products={data?.items}
        loading={isLoading}
      />
    </section>
  );
}

function MockProductRail({ config }: SectionProps) {
  const title = str(config.title);
  const eyebrow = str(config.eyebrow);
  const linkTo = str(config.linkTo) ?? "/browse/$slug";
  const railTag = tag(config.tag);
  const count = num(config.count) ?? 6;
  const columns = num(config.columns) ?? 6;
  const showAdd = Boolean(config.showAdd);

  return (
    <section>
      {title && <SectionHeader title={title} eyebrow={eyebrow} linkTo={linkTo} />}
      <ProductRail count={count} columns={columns} tag={railTag} showAdd={showAdd} />
    </section>
  );
}

function ProductRailSection({ config }: SectionProps) {
  return config.useRealData ? <RealProductRail config={config} /> : <MockProductRail config={config} />;
}

function FeatureGridSection() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <FeatureTile
        tone="muted"
        eyebrow="alkemart Pay"
        title="5% cash back at alkemart"
        body="Members earn every day with the alkemart Cash Rewards card."
        layout="stacked"
        imageShape="circle"
        imageTone="brand"
      />
      <FeatureTile
        tone="secondary"
        eyebrow="A winning choice"
        title="Gift cards for Black Stars fans"
        body="Instant delivery — perfect for last-minute presents."
        layout="stacked"
        imageTone="accent"
      />
      <FeatureTile
        tone="surface"
        eyebrow="NHIS Pharmacy"
        title="NHIS pharmacy claims now supported"
        body="Submit and track your prescription claims online."
        layout="stacked"
      />
      <FeatureTile
        tone="surface"
        eyebrow="Back-to-school ready"
        title="Vision care for the year ahead"
        body="Find an eye doctor near you to book an appointment."
        link="Find a provider"
        layout="stacked"
        imageTone="accent"
      />
    </section>
  );
}

const dealColumns = [
  { title: "Rollback deals", tone: "surface" as const, tag: "rollback" as const },
  { title: "Clearance picks", tone: "secondary" as const, tag: "clearance" as const },
  { title: "Best sellers", tone: "surface" as const, tag: "best" as const },
  { title: "Popular right now", tone: "muted" as const, tag: "popular" as const },
  { title: "New arrivals", tone: "surface" as const, tag: "new" as const },
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

function DealsGridSection() {
  return (
    <section>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {dealColumns.map((c) => (
          <DealsColumn key={c.title} {...c} />
        ))}
      </div>
    </section>
  );
}

const weeklyRow = ["Weekly Essentials", "Pantry", "Meat & seafood", "Frozen", "Produce", "Snacks", "Beverages", "Deli"];
const categoryRow = ["Grocery", "Home", "Patio & Garden", "Fashion", "Tech", "Baby", "Toys", "Beauty"];

function CategoryRowSection({ config }: SectionProps) {
  const title = str(config.title) ?? "Get it all right here";
  const linkTo = str(config.linkTo) ?? "/browse/$slug";

  return (
    <section>
      <SectionHeader title={title} linkTo={linkTo} />
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4 md:grid-cols-8">
          {weeklyRow.map((c) => (
            <CategoryTile key={c} label={c} imageTone="default" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-4 md:grid-cols-8">
          {categoryRow.map((c) => (
            <CategoryTile key={c} label={c} imageTone="brand" />
          ))}
        </div>
      </div>
    </section>
  );
}

const bentoCards = [
  { title: "Supplies, food & more — Parties start here", eyebrow: "Supplies" },
  { title: "The hosting collection — Sundays served", eyebrow: "Hosting" },
  { title: "Sandals for everyone", eyebrow: "New arrivals" },
  { title: "Ready to make a splash", eyebrow: "Pool essentials" },
];

function BentoGridSection({ config }: SectionProps) {
  const { bg: themeBg, fg: themeFg } = resolveThemeColors(
    str(config.theme),
    str(config.customBg),
    str(config.customFg),
  );

  if (config.variant === "with_rail") {
    const railTitle = str(config.railTitle) ?? "";
    const railLinkTo = str(config.railLinkTo) ?? "/browse/$slug";
    const railCount = num(config.railCount) ?? 4;
    const railColumns = num(config.railColumns) ?? 4;
    const showAdd = Boolean(config.showAdd);

    return (
      <section className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <BentoCard
          size="lg"
          tone="secondary"
          eyebrow="Now streaming"
          title="They're back this July"
          cta="Shop now"
          imageRatio={4 / 3}
          imageTone="brand"
          themeBg={themeBg}
          themeFg={themeFg}
        />
        <div>
          <SectionHeader title={railTitle} linkTo={railLinkTo} />
          <ProductRail count={railCount} columns={railColumns} showAdd={showAdd} />
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-4">
      <BentoCard
        size="lg"
        tone="secondary"
        eyebrow="Decor, food & more"
        title="Outdoor hosting for Republic Day"
        className="md:col-span-2 md:row-span-2"
        imageRatio={16 / 9}
        imageTone="brand"
        themeBg={themeBg}
        themeFg={themeFg}
      />
      {bentoCards.map((c) => (
        <BentoCard
          key={c.title}
          size="md"
          tone="muted"
          eyebrow={c.eyebrow}
          title={c.title}
          imageRatio={4 / 3}
          imageTone="default"
          themeBg={themeBg}
          themeFg={themeFg}
        />
      ))}
    </section>
  );
}

const videoHandles = ["@ama_cooks", "@akwaboah", "@kwesi.hifi", "@abenathefit"];
const videoPrices = ["7.97", "44.98", "9.97", "12.85"];

function VideoGridSection({ config }: SectionProps) {
  const title = str(config.title) ?? "Featured on alkemart TV";
  const linkTo = str(config.linkTo) ?? "/browse/$slug";

  return (
    <section>
      <SectionHeader title={title} linkTo={linkTo} />
      <div className="grid gap-4 md:grid-cols-4">
        {videoHandles.map((h, i) => (
          <VideoCard key={h} handle={h} price={videoPrices[i]} tone={i % 2 === 0 ? "brand" : "default"} />
        ))}
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
        linkTo={str(config.railLinkTo) ?? "/browse/$slug"}
      />
      <ProductRail
        count={num(config.railCount) ?? 3}
        columns={num(config.railColumns) ?? 3}
        tag={tag(config.railTag)}
        showAdd={Boolean(config.showAdd)}
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

function ExpressBandSection() {
  return <ExpressDeliveryBand />;
}

const SECTION_REGISTRY: Record<HomepageSectionType, (props: SectionProps) => React.JSX.Element> = {
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
};

/**
 * Renders the ordered, filtered list of homepage sections coming from
 * `GET /homepage/sections` by dispatching each section's `type` to its
 * registered component. Unknown types are skipped so older clients degrade
 * gracefully if new section types are added server-side.
 */
export function HomepageSectionList({ sections }: { sections: HomepageSection[] }) {
  return (
    <>
      {sections.map((section) => {
        const Component = SECTION_REGISTRY[section.type];
        if (!Component) return null;
        return <Component key={section.id} config={section.config} />;
      })}
    </>
  );
}
