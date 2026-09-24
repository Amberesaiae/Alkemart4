import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { MapPin } from "@phosphor-icons/react"
import { IconSafe } from "@/design/icons"
import { useDeliverTo } from "@/lib/deliver-to"
import type { StoreVendorDetail } from "@/lib/vendors"

/**
 * Right-rail assurance cards for the PDP (canonical hierarchy, honest data).
 * DeliveryCard reflects the buyer's active delivery area from global context.
 * SellerCard shows authentic shop details with no fake scores or shields.
 */

/** Renders a mowafer webp icon; hides gracefully if the asset fails. */
function AssuranceImg({
  src,
  size = 20,
}: {
  src: string
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="object-contain"
      onError={() => setFailed(true)}
    />
  )
}

function CardShell({
  title,
  children,
  label,
}: {
  title: string
  children: React.ReactNode
  label: string
}) {
  return (
    <section
      aria-label={label}
      className="space-y-3 rounded-lg border border-border/80 bg-card p-4 shadow-2xs"
    >
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function PdpDeliveryCard({
  sellerName,
  location,
  area,
  deliveryMinutes: _deliveryMinutes,
  policy,
  paused,
}: {
  sellerName: string | null
  location: string | null
  area: string | null
  deliveryMinutes: number | null
  policy: { shipping?: string; returnsDays?: number; warranty?: string } | null
  paused: boolean
}) {
  const [globalArea] = useDeliverTo()
  const destination = globalArea || area || "Accra Central"
  const returnDays = policy?.returnsDays ?? 15

  return (
    <CardShell title="Delivery & Returns" label="Delivery and returns">
      {/* Active delivery area */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2.5 text-xs text-muted-foreground">
        <MapPin size={15} weight="bold" className="shrink-0 text-primary-strong" />
        <span className="truncate">
          Delivering to <strong className="font-semibold text-foreground">{destination}</strong>
        </span>
      </div>

      <ul className="space-y-3 pt-1 text-xs">
        <li className="flex gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
            <IconSafe name="delivery-moto" size={22} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 leading-snug">
            <p className="font-bold text-foreground">Standard Delivery</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Dispatched to {destination} in 1–2 business days.
            </p>
          </div>
        </li>

        <li className="flex gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
            <IconSafe name="wallet" size={22} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 leading-snug">
            <p className="font-bold text-foreground">Flexible Payment</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Pay via Mobile Money (MTN, Telecel, AT), Card, or Cash on Delivery.
            </p>
          </div>
        </li>

        <li className="flex gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
            <IconSafe name="delivery-handoff" size={22} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 leading-snug">
            <p className="font-bold text-foreground">Return Policy</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Free return within {returnDays} days for all eligible items.
            </p>
          </div>
        </li>


        {paused ? (
          <li className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
            This shop is paused and not taking orders right now.
          </li>
        ) : null}
      </ul>
    </CardShell>
  )
}

export function PdpSellerCard({ vendor }: { vendor: StoreVendorDetail }) {
  const trust = vendor.trust
  const hasRating = Boolean(trust?.ratingAvg && trust.ratingAvg > 0 && trust?.ratingCount && trust.ratingCount > 0)

  return (
    <CardShell title="Seller information" label="Seller information">
      <div className="border-b border-border/60 pb-3">
        <Link
          to="/shops/$slug"
          params={{ slug: vendor.slug }}
          className="truncate font-bold text-foreground hover:text-primary hover:underline text-sm block"
        >
          {vendor.name}
        </Link>
        <p className="text-xs text-muted-foreground mt-0.5">
          {hasRating ? (
            <span>★ {trust?.ratingAvg?.toFixed(1)} · {trust?.ratingCount} {trust?.ratingCount === 1 ? "review" : "reviews"}</span>
          ) : trust?.location ? (
            <span>Based in {trust.location}</span>
          ) : (
            <span>Independent Merchant</span>
          )}
        </p>
      </div>

      {trust?.location || typeof trust?.policy?.returnsDays === "number" ? (
        <div className="space-y-1.5 pt-2 text-xs">
          {trust.location ? (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <span>Location:</span>
              <strong className="font-medium text-foreground">{trust.location}</strong>
            </p>
          ) : null}
          {typeof trust.policy?.returnsDays === "number" ? (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <span>Returns:</span>
              <strong className="font-medium text-foreground">{trust.policy.returnsDays}-day return window</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="pt-2">
        <Link
          to="/shops/$slug"
          params={{ slug: vendor.slug }}
          className="inline-flex h-8 w-full items-center justify-center rounded-md border border-border/80 bg-background text-xs font-bold text-foreground  hover:bg-muted"
        >
          Visit Store
        </Link>
      </div>
    </CardShell>
  )
}
