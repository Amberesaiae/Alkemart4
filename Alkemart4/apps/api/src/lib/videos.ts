import { parseVideoLink } from "@alkemart/domain"
import type { VideoRow } from "../videos-store"

/** A video as the apps show it. The embed URL is rebuilt from platform + id — never the pasted link. */
export function publicVideo(v: VideoRow) {
  const parsed = parseVideoLink(v.url)
  return {
    id: v.id,
    productId: v.productId,
    sellerId: v.sellerId,
    platform: v.platform,
    url: parsed.url,
    embedUrl: parsed.embedUrl,
    // YouTube gives a still we can show before the tap; others show a platform card.
    thumbnailUrl: v.platform === "youtube" ? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` : null,
    status: v.status,
    featured: v.featured,
    rejectReason: v.rejectReason,
    createdAt: v.createdAt.toISOString(),
  }
}
