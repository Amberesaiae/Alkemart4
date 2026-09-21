import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "@phosphor-icons/react";
import { IconSafe } from "@/design/icons";
import { iconForCategory, resolveHeaderCategories } from "@/lib/catalog-nav";
import type { StoreCategory } from "@/lib/products";

export function HomeExploreCategories({
  categories,
}: {
  categories: StoreCategory[];
}) {
  const shown = resolveHeaderCategories(categories).slice(0, 6);
  if (!shown.length) return null;

  return (
    <section
      aria-labelledby="explore-categories-title"
      className="overflow-hidden rounded-2xl bg-foreground text-background"
    >
      <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
        <div className="flex flex-col justify-between border-b border-background/15 p-6 sm:p-8 lg:min-h-80 lg:border-b-0 lg:border-r">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">
              Market directory · 01—06
            </p>
            <h2
              id="explore-categories-title"
              className="mt-4 max-w-xs text-3xl font-black leading-[0.98] tracking-tight sm:text-4xl"
            >
              Find your way around the market.
            </h2>
          </div>
          <p className="mt-8 max-w-sm text-sm leading-relaxed text-background/65">
            Six departments. One clear route into everyday essentials, personal
            style and the things that make home work.
          </p>
        </div>
        <div className="grid sm:grid-cols-2">
          {shown.map((category, index) => (
            <Link
              key={category.id}
              to="/categories/$slug"
              params={{ slug: category.handle || category.id }}
              className={`group flex min-h-28 items-center gap-4 border-b border-background/15 p-5 transition-colors hover:bg-background hover:text-foreground ${index % 2 === 0 ? "sm:border-r" : ""} ${index >= 4 ? "sm:border-b-0" : ""}`}
            >
              <span className="font-mono text-xs text-primary">
                0{index + 1}
              </span>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-current/20">
                <IconSafe
                  name={iconForCategory(category.name, category.handle)}
                  size={24}
                  preferAsset
                />
              </span>
              <span className="min-w-0 flex-1 text-base font-extrabold leading-tight">
                {category.name}
              </span>
              <ArrowUpRight
                className="shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                size={19}
                weight="bold"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
