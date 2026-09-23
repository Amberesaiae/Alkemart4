import { Link } from "@tanstack/react-router";
import { ArrowRight, MapPin, Storefront } from "@phosphor-icons/react";

export function HomeLocalMarket() {
  return (
    <section
      className="relative isolate overflow-hidden rounded-xl bg-primary text-primary-foreground"
      aria-labelledby="local-market-title"
    >
      <div
        className="pointer-events-none absolute -bottom-20 -left-4 -z-10 select-none text-[17rem] font-black leading-none tracking-[-0.12em] text-primary-foreground/[0.07]"
        aria-hidden="true"
      >
        GH
      </div>
      <div className="grid min-h-[25rem] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-between p-7 sm:p-10 lg:p-12">
          <div>
            <span className="inline-flex items-center gap-1.5 border-b border-primary-foreground/40 pb-1 text-xs font-black uppercase tracking-[0.2em]">
              <MapPin size={14} weight="fill" /> Accra · Kumasi · Beyond
            </span>
            <h2
              id="local-market-title"
              className="mt-6 max-w-md text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl"
            >
              The shops you know. A better way to reach them.
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-primary-foreground/75 sm:text-base">
              Discover independent Ghanaian sellers, compare their offers and
              choose the delivery option that works for you.
            </p>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-5">
            <Link
              to="/shops"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-extrabold text-background transition hover:opacity-90"
            >
              <Storefront size={18} weight="duotone" /> Meet the sellers{" "}
              <ArrowRight size={16} weight="bold" />
            </Link>
            <span className="text-xs font-bold uppercase tracking-widest text-primary-foreground/65">
              Shop local · Compare clearly
            </span>
          </div>
        </div>
        <div className="relative min-h-80 overflow-hidden lg:min-h-full">
          <img
            src="/images/categories/mosaic-handbags.jpg"
            alt="Handbags available from marketplace sellers"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-primary to-transparent"
            aria-hidden="true"
          />
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4 rounded-xl bg-foreground/90 p-4 text-background backdrop-blur-sm sm:left-auto sm:max-w-xs">
            <div>
              <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-primary">
                Seller spotlight
              </p>
              <p className="mt-1 text-lg font-extrabold leading-tight">
                Independent shops, all in one place.
              </p>
            </div>
            <ArrowRight
              size={22}
              weight="bold"
              className="-rotate-45 shrink-0 text-primary"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
