import { useState } from "react"
import cart from "../assets/empty-states/empty-cart-v2.png"
import search from "../assets/empty-states/no-results-v2.png"
import listing from "../assets/empty-states/first-listing-v4.png"
import saved from "../assets/empty-states/nothing-saved-v1.png"
import orders from "../assets/empty-states/no-orders-v1.png"
import messages from "../assets/empty-states/no-messages-v1.png"
import confirmed from "../assets/empty-states/order-confirmed-v1.png"
import launched from "../assets/empty-states/shop-launched-v1.png"
import offline from "../assets/empty-states/offline-v1.png"
import unavailable from "../assets/empty-states/page-unavailable-v1.png"

export const brandIllustrations = {
  "empty-cart": cart,
  "no-results": search,
  "first-listing": listing,
  "empty-shelf": listing,
  "empty-saved": saved,
  "empty-orders": orders,
  "no-messages": messages,
  "order-confirmed": confirmed,
  "shop-launched": launched,
  offline,
  "not-found": unavailable,
} as const

export type BrandIllustrationName = keyof typeof brandIllustrations

/** Decorative artwork: the neighbouring heading carries the state meaning. */
export function BrandIllustration({ name, className, fallback = null }: {
  name: BrandIllustrationName
  className?: string
  fallback?: React.ReactNode
}) {
  const src = brandIllustrations[name]
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (failedSrc === src) return <>{fallback}</>
  return <img src={src} alt="" aria-hidden="true" width={192} height={192}
    className={className ?? "mx-auto h-40 w-40 max-w-full object-contain sm:h-48 sm:w-48"}
    decoding="async" onError={() => setFailedSrc(src)} />
}
