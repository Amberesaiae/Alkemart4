import { useEffect, useState } from "react"
import type { HomeLink, HomeSection, HomeTheme } from "@alkemart/shared/homepage"
import { countdownParts, timeRemaining } from "@alkemart/shared/homepage"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { SmartLink } from "@/components/commerce/smart-link"
import { cn } from "@/lib/utils"
import { PromoCarousel } from "./promo-carousel"

type Promo = Extract<
  HomeSection,
  { type: "promo_hero" | "promo_band" | "promo_grid" | "countdown_banner" | "marquee" | "value_grid" }
>

const THEME: Record<HomeTheme, string> = {
  gold: "bg-brand text-brand-foreground",
  black: "bg-[#111114] text-white",
  white: "bg-surface text-foreground",
}

/** Studio links are site-relative or absolute; both render as plain anchors. */
function Cta({ link, theme, secondary, compact }: { link: HomeLink; theme: HomeTheme; secondary?: boolean; compact?: boolean }) {
  return (
    <Button
      asChild
      size="xl"
      variant={secondary ? "outline" : theme === "black" ? "brand" : "default"}
      className={cn(compact && "md:h-11 md:px-5", secondary && theme === "black" && "border-white/30 bg-transparent text-white hover:bg-white/10")}
    >
      <SmartLink href={link.href}>
        {link.label}
        {!secondary ? <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" /> : null}
      </SmartLink>
    </Button>
  )
}

function Clock({ to, expiredLabel }: { to: string; expiredLabel?: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const ms = timeRemaining(to, now)
  if (ms == null) return null
  if (ms <= 0) return expiredLabel ? <p className="font-semibold">{expiredLabel}</p> : null
  const p = countdownParts(ms)
  return (
    <div className="flex gap-2 tabular">
      {[
        [p.days, "days"],
        [p.hours, "hrs"],
        [p.minutes, "min"],
        [p.seconds, "sec"],
      ].map(([v, l]) => (
        <span key={l as string} className="grid min-w-14 place-items-center rounded-2xl bg-black/10 px-2 py-2">
          <span className="text-2xl font-extrabold">{String(v).padStart(2, "0")}</span>
          <span className="text-xs opacity-75">{l}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * The one campaign beat on the homepage, rendered from the homepage studio.
 * Copy owns the left, art owns the right (or the cover, under a scrim).
 */
export function PromoSection({ section }: { section: Promo }) {
  if (section.type === "marquee") {
    return (
      <section className={cn("overflow-hidden py-3", THEME[section.theme])} aria-label="Announcements">
        <ul className="container-page flex gap-8 overflow-x-auto text-sm font-semibold whitespace-nowrap [scrollbar-width:none]">
          {section.items.map((it) => (
            <li key={it.id}>{it.href ? <SmartLink href={it.href} className="hover:underline">{it.label}</SmartLink> : it.label}</li>
          ))}
        </ul>
      </section>
    )
  }
  if (section.type === "value_grid") {
    return (
      <section className="container-page">
        {section.title ? <h2 className="mb-4 text-2xl font-extrabold">{section.title}</h2> : null}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {section.items.map((it) => (
            <li key={it.id} className="rounded-3xl bg-surface p-5">
              <p className="font-semibold">{it.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{it.body}</p>
            </li>
          ))}
        </ul>
      </section>
    )
  }
  if (section.type === "promo_grid") {
    return (
      <section className="container-page">
        {section.title ? <h2 className="mb-4 text-2xl font-extrabold">{section.title}</h2> : null}
        <ul className={cn("grid gap-3 sm:gap-4", section.columns === 2 ? "sm:grid-cols-2" : section.columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4")}>
          {section.tiles.map((t) => (
            <li key={t.id}>
              <SmartLink href={t.href} className={cn("group relative flex min-h-36 overflow-hidden rounded-3xl p-4 sm:min-h-40 sm:p-5", THEME[section.theme])}>
                {t.imageUrl ? (
                  <img src={t.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                ) : null}
                <span className={cn("relative mt-auto", t.imageUrl && "rounded-xl bg-black/70 px-3 py-2 text-white")}>
                  {t.eyebrow ? <span className="block text-xs font-semibold tracking-wide uppercase opacity-80">{t.eyebrow}</span> : null}
                  <span className="block text-xl font-extrabold">{t.title}</span>
                  {t.body ? <span className="mt-1 block text-sm opacity-85">{t.body}</span> : null}
                </span>
              </SmartLink>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  // promo_hero · promo_band · countdown_banner
  const cover = section.type === "promo_band" && section.layout === "cover" && section.imageUrl
  const scrim = section.type === "promo_band" ? (section.scrim ?? "strong") : "strong"
  const secondary = section.type === "promo_band" ? section.secondaryAction : undefined
  const eyebrow = "eyebrow" in section ? section.eyebrow : undefined
  const body = "body" in section ? section.body : undefined
  const subtitle = section.type === "promo_hero" ? section.subtitle : undefined
  const compactBand = section.type === "promo_band"
  const carousel = section.type === "promo_band" && section.id === "deals-band" && cover

  return (
    <section className="container-page">
      {carousel ? <PromoCarousel section={section} /> : null}
      <div
        className={cn(
          "group relative isolate grid overflow-hidden rounded-[2rem]",
          cover ? "min-h-40 text-white sm:min-h-44" : cn("md:grid-cols-2", THEME[section.theme]),
          compactBand && "md:min-h-32",
          carousel && "md:hidden",
        )}
      >
        {cover ? (
          <>
            <img
              src={section.imageUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 -z-10 size-full object-cover md:relative md:inset-auto md:h-auto md:w-full md:object-contain"
              style={{ objectPosition: section.type === "promo_band" ? section.focalPoint : undefined }}
            />
            {scrim !== "none" ? (
              <span
                aria-hidden
                className={cn(
                  "absolute inset-0 -z-10 bg-gradient-to-r",
                  scrim === "strong" ? "from-black/80 via-black/45 to-transparent" : "from-black/55 via-black/15 to-transparent",
                )}
              />
            ) : null}
          </>
        ) : null}
        <div className={cn("flex flex-col justify-center gap-2.5 p-4 sm:gap-3 sm:p-5 lg:p-6", compactBand && "md:gap-2 md:px-6 md:py-4 lg:py-4", cover && "md:absolute md:inset-0")}>
          {eyebrow ? <p className={cn("text-xs font-semibold tracking-[0.18em] uppercase opacity-80", compactBand && "md:hidden")}>{eyebrow}</p> : null}
          <h2 className="max-w-lg text-xl leading-tight font-extrabold sm:text-2xl">{section.title}</h2>
          {subtitle || body ? <p className={cn("max-w-md text-sm opacity-85 sm:text-base", compactBand && "md:hidden")}>{subtitle ?? body}</p> : null}
          {section.type === "countdown_banner" ? (
            <Clock to={section.countdownTo} expiredLabel={section.expiredLabel} />
          ) : null}
          {section.action || secondary ? (
            <div className="flex flex-wrap gap-2">
              {section.action ? <Cta link={section.action} theme={section.theme} compact={compactBand} /> : null}
              {secondary ? <Cta link={secondary} theme={section.theme} secondary compact={compactBand} /> : null}
            </div>
          ) : null}
        </div>
        {!cover && section.imageUrl ? (
          <div className={cn("relative min-h-32 sm:min-h-36", compactBand && "md:min-h-32")}>
            <img src={section.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
          </div>
        ) : null}
      </div>
    </section>
  )
}
