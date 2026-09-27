import { useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { ProductRail } from "@/components/commerce/product-grid"
import { SmartLink } from "@/components/commerce/smart-link"
import { useIsDesktop } from "@/hooks/use-media-query"
import { fireCourseEvent, type Course, type CourseCampaign } from "@/lib/course"
import { trackPromotionSelected, trackPromotionViewed } from "@/lib/analytics"

function useViewBeacon(placementCode: string, campaign: CourseCampaign, position: number) {
  const ref = useRef<HTMLElement | null>(null)
  const fired = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el || fired.current || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || fired.current) return
        fired.current = true
        fireCourseEvent({ campaignId: campaign.id, placementCode, position, event: "view" })
        trackPromotionViewed({ placementId: placementCode, campaignId: campaign.trackingId, creativeId: null, position })
        io.disconnect()
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [placementCode, campaign.id, campaign.trackingId, position])
  return ref
}

function select(placementCode: string, campaign: CourseCampaign, position: number) {
  fireCourseEvent({ campaignId: campaign.id, placementCode, position, event: "select" })
  trackPromotionSelected({ placementId: placementCode, campaignId: campaign.trackingId, creativeId: null, position })
}

function CampaignBlock({ placementCode, campaign, position }: { placementCode: string; campaign: CourseCampaign; position: number }) {
  const desktop = useIsDesktop()
  const ref = useViewBeacon(placementCode, campaign, position)
  // Mobile gets its own creative when the campaign has one.
  const creative = (desktop ? campaign.creative.desktop : campaign.creative.mobile) ?? campaign.creative.desktop ?? campaign.creative.mobile
  return (
    <section
      ref={ref}
      aria-label={campaign.name}
      className="container-page"
      onClickCapture={(e) => {
        if (e.target instanceof Element && e.target.closest("a")) select(placementCode, campaign, position)
      }}
    >
      <div className="group/campaign mb-3 grid gap-2 overflow-hidden rounded-[1.5rem] bg-surface sm:mb-4 md:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col justify-center gap-1.5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {campaign.sponsored ? <Badge variant="outline">Sponsored</Badge> : null}
            {campaign.terms ? <Badge className="bg-brand text-brand-foreground">{campaign.terms.label}</Badge> : null}
          </div>
          <h2 className="text-lg font-extrabold sm:text-xl">{creative?.title ?? campaign.name}</h2>
          {creative?.subtitle ? <p className="text-sm text-muted-foreground">{creative.subtitle}</p> : null}
          {campaign.terms?.summary ? <p className="text-xs text-muted-foreground">{campaign.terms.summary}</p> : null}
          {creative?.link ? (
            <SmartLink href={creative.link} className="mt-1 inline-flex w-fit items-center rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/85">
              Shop now
            </SmartLink>
          ) : null}
        </div>
        {creative?.imageUrl ? (
          <img src={creative.imageUrl} alt="" loading="lazy" className="h-36 w-full object-cover md:h-40" />
        ) : null}
      </div>
      {placementCode !== "marquee" ? (
        <ProductRail products={campaign.products.slice(0, 12)} label={campaign.name} />
      ) : null}
    </section>
  )
}

/** Paid/merchandised placements resolved by the course API. */
export function CampaignPlacements({ course }: { course: Course }) {
  return (
    <>
      {course.placements.flatMap((pl) =>
        pl.campaigns.map((c, i) => (
          <CampaignBlock key={`${pl.code}-${c.id}`} placementCode={pl.code} campaign={c} position={i} />
        )),
      )}
    </>
  )
}
