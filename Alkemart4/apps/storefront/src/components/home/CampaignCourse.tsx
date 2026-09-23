import { useEffect, useRef } from "react"
import { MerchDealBadge } from "@workspace/ui"
import { ProductCard } from "@/components/product-card"
import { ProductGridShell } from "@/components/product-grid"
import {
  fireCourseEvent,
  type Course,
  type CourseCampaign,
  type CourseCreative,
} from "@/lib/course"
import { trackPromotionSelected, trackPromotionViewed } from "@/lib/analytics"
import { cn } from "@/lib/utils"

function useViewBeacon(
  placementCode: string,
  campaign: CourseCampaign,
  position: number | null,
) {
  const ref = useRef<HTMLDivElement | null>(null)
  const fired = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el || fired.current) return
    if (typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.current) {
            fired.current = true
            fireCourseEvent({
              campaignId: campaign.id,
              placementCode,
              position,
              event: "view",
            })
            trackPromotionViewed({
              placementId: placementCode,
              campaignId: campaign.trackingId,
              creativeId: null,
              position,
            })
            io.disconnect()
          }
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementCode, campaign.id])
  return ref
}

function selectBeacon(
  placementCode: string,
  campaign: CourseCampaign,
  position: number | null,
  creativeId?: string | null,
) {
  fireCourseEvent({
    campaignId: campaign.id,
    placementCode,
    creativeId: creativeId ?? null,
    position,
    event: "select",
  })
  trackPromotionSelected({
    placementId: placementCode,
    campaignId: campaign.trackingId,
    creativeId: creativeId ?? null,
    position,
  })
}

function CreativeArt({ creative, title }: { creative: CourseCreative; title: string }) {
  if (!creative?.imageUrl) return null
  return (
    <img
      src={creative.imageUrl}
      alt=""
      aria-hidden
      className="h-40 w-full rounded-xl object-cover sm:h-56"
      loading="lazy"
    />
  )
}

function SponsoredTag() {
  return <MerchDealBadge label="Sponsored" />
}

function CampaignHeader({
  placementCode,
  campaign,
  creative,
}: {
  placementCode: string
  campaign: CourseCampaign
  creative: CourseCreative
}) {
  if (!creative) return null
  const external = !!creative.link && /^https?:\/\//i.test(creative.link)
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {campaign.sponsored ? <SponsoredTag /> : null}
        {campaign.terms ? (
          <span className="text-xs font-bold text-muted-foreground">{campaign.terms.label}</span>
        ) : null}
      </div>
      <CreativeArt creative={creative} title={creative.title} />
      <h2 className="type-section text-foreground">{creative.title}</h2>
      {creative.subtitle ? (
        <p className="text-sm text-muted-foreground">{creative.subtitle}</p>
      ) : null}
      {campaign.terms ? (
        <p className="text-xs text-muted-foreground">{campaign.terms.summary}</p>
      ) : null}
      {creative.link ? (
        <a
          href={creative.link}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className="inline-block text-sm font-bold text-primary hover:underline"
          onClick={() => selectBeacon(placementCode, campaign, null)}
        >
          Shop now
        </a>
      ) : null}
    </div>
  )
}

function PlacementBlock({
  placementCode,
  campaigns,
}: {
  placementCode: string
  campaigns: CourseCampaign[]
}) {
  return (
    <div className="space-y-8">
      {campaigns.map((campaign, ci) => (
        <CampaignBlock
          key={campaign.id}
          placementCode={placementCode}
          campaign={campaign}
          position={ci}
        />
      ))}
    </div>
  )
}

function CampaignBlock({
  placementCode,
  campaign,
  position,
}: {
  placementCode: string
  campaign: CourseCampaign
  position: number
}) {
  const ref = useViewBeacon(placementCode, campaign, position)
  const creative = campaign.creative.desktop ?? campaign.creative.mobile
  const products = campaign.products.slice(0, 8)
  return (
    <section
      ref={ref}
      aria-label={campaign.name}
      className={cn(
        "space-y-3",
        placementCode === "hero" || placementCode === "promo_band"
          ? "rounded-xl border border-border bg-card p-4 sm:p-6"
          : undefined,
      )}
    >
      <CampaignHeader placementCode={placementCode} campaign={campaign} creative={creative} />
      {placementCode === "marquee" ? null : (
        <div
          onClickCapture={(e) => {
            if (!(e.target instanceof Element)) return
            if (!e.target.closest("a")) return
            selectBeacon(placementCode, campaign, position)
          }}
        >
          <ProductGridShell>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} size="tile" />
            ))}
          </ProductGridShell>
        </div>
      )}
    </section>
  )
}

/**
 * Resolved campaign placements (Phase 5C): paid inventory leads the page.
 * Rule-backed shelves moved into the managed flow (HomepageSections), where
 * they sit beneath the departments mosaic and share the claim pipeline.
 * Empty slots collapse upstream — this component only renders what the
 * course served. Paid placements carry a Sponsored label; nothing is ever
 * silently replaced.
 */
export function CampaignCourse({ course }: { course: Course }) {
  if (course.placements.length === 0) return null
  return (
    <div className="space-y-8 sm:space-y-12">
      {course.placements.map((p) => (
        <PlacementBlock key={p.code} placementCode={p.code} campaigns={p.campaigns} />
      ))}
    </div>
  )
}
