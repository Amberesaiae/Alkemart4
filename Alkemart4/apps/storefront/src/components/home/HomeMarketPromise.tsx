import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

const CAMPAIGNS = [
  {
    label: "Free delivery campaign",
    to: "/delivery" as const,
    image: "/images/campaigns/alkemart-delivery-v1.png",
  },
  {
    label: "Everyday fashion campaign",
    to: "/categories/$slug" as const,
    slug: "fashion-apparel",
    image: "/images/campaigns/alkemart-fashion-v1.png",
  },
  {
    label: "Technology deals campaign",
    to: "/categories/$slug" as const,
    slug: "phones-electronics",
    image: "/images/campaigns/alkemart-tech-v1.png",
  },
]

export function HomeMarketPromise() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % CAMPAIGNS.length),
      6500,
    )
    return () => window.clearInterval(timer)
  }, [])

  const campaign = CAMPAIGNS[active]
  const move = (direction: -1 | 1) =>
    setActive((current) =>
      (current + direction + CAMPAIGNS.length) % CAMPAIGNS.length,
    )

  return (
    <section aria-roledescription="carousel" aria-label="Featured marketplace campaigns" className="relative">
      <Link
        to={campaign.to}
        params={campaign.slug ? { slug: campaign.slug } : undefined}
        aria-label={campaign.label}
        className="block aspect-[3/1] min-h-64 overflow-hidden rounded-xl bg-muted ring-1 ring-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <img key={campaign.image} src={campaign.image} alt="" className="h-full w-full object-cover" />
      </Link>
      <button type="button" onClick={() => move(-1)} aria-label="Previous campaign" className="absolute left-0 top-1/2 z-20 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-sm transition hover:bg-muted">
        <CaretLeft size={19} weight="bold" />
      </button>
      <button type="button" onClick={() => move(1)} aria-label="Next campaign" className="absolute right-0 top-1/2 z-20 flex size-11 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-sm transition hover:bg-muted">
        <CaretRight size={19} weight="bold" />
      </button>
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur-sm">
        {CAMPAIGNS.map((item, index) => (
          <button key={item.label} type="button" onClick={() => setActive(index)} aria-label={`Show campaign ${index + 1}`} aria-current={index === active} className={cn("h-1.5 rounded-full transition-all", index === active ? "w-6 bg-white" : "w-1.5 bg-white/60 hover:bg-white")} />
        ))}
      </div>
    </section>
  )
}
