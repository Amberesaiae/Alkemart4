/**
 * Product video links and photo spec reading (pilot phase 6).
 *
 * Videos are links to TikTok, Instagram or YouTube — never uploads (those
 * come later). Only these hosts are accepted, the id is extracted and the
 * embed URL is rebuilt by us, so a pasted link can't smuggle a script or a
 * different site into the page. Pages load the player only when tapped.
 */

export type VideoPlatform = "youtube" | "tiktok" | "instagram"
export type ParsedVideo = { platform: VideoPlatform; videoId: string; url: string; embedUrl: string }

export class VideoLinkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VideoLinkError"
  }
}

/** At most this many videos per listing. */
export const MAX_VIDEOS_PER_PRODUCT = 3

const ID = /^[A-Za-z0-9_-]{5,40}$/

/** Parse a pasted link into a platform + id we trust. Throws VideoLinkError in plain words. */
export function parseVideoLink(raw: string): ParsedVideo {
  let u: URL
  try {
    u = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`)
  } catch {
    throw new VideoLinkError("Paste the full link from TikTok, Instagram or YouTube.")
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new VideoLinkError("Paste the full link from TikTok, Instagram or YouTube.")
  const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, "")
  const parts = u.pathname.split("/").filter(Boolean)
  const ok = (platform: VideoPlatform, id: string | undefined): ParsedVideo => {
    if (!id || !ID.test(id)) throw new VideoLinkError("That link doesn't point to a single video.")
    if (platform === "youtube") return { platform, videoId: id, url: `https://www.youtube.com/watch?v=${id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` }
    if (platform === "tiktok") return { platform, videoId: id, url: `https://www.tiktok.com/video/${id}`, embedUrl: `https://www.tiktok.com/embed/v2/${id}` }
    return { platform, videoId: id, url: `https://www.instagram.com/reel/${id}/`, embedUrl: `https://www.instagram.com/reel/${id}/embed` }
  }
  if (host === "youtu.be") return ok("youtube", parts[0])
  if (host === "youtube.com" || host === "music.youtube.com") {
    if (parts[0] === "watch") return ok("youtube", u.searchParams.get("v") ?? undefined)
    if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") return ok("youtube", parts[1])
  }
  if (host === "tiktok.com") {
    const i = parts.indexOf("video")
    if (i >= 0 && /^\d{8,25}$/.test(parts[i + 1] ?? "")) return ok("tiktok", parts[i + 1])
    throw new VideoLinkError("Use the full TikTok video link (open the video, tap Share → Copy link, then open it once in a browser).")
  }
  if (host === "instagram.com" && (parts[0] === "reel" || parts[0] === "p" || parts[0] === "reels")) return ok("instagram", parts[1])
  throw new VideoLinkError("Only TikTok, Instagram and YouTube video links can be added.")
}

/** Free photo spec reads per seller per calendar month (more on plans later). */
export const DEFAULT_PHOTO_READS_PER_MONTH = 10

/** "2026-09" in the market's clock, for monthly allowances. */
export function allowancePeriod(now: Date, utcOffsetMinutes = 0): string {
  const local = new Date(now.getTime() + utcOffsetMinutes * 60_000)
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Admin-tunable listing helpers (platform_settings "listing_policy"). */
export type ListingPolicy = { photoReadsPerMonth: number }
export const DEFAULT_LISTING_POLICY: ListingPolicy = { photoReadsPerMonth: DEFAULT_PHOTO_READS_PER_MONTH }

export function parseListingPolicy(input: unknown): { ok: true; policy: ListingPolicy } | { ok: false; message: string } {
  const v = (input && typeof input === "object" ? input : {}) as Partial<Record<keyof ListingPolicy, unknown>>
  const n = v.photoReadsPerMonth === undefined ? DEFAULT_LISTING_POLICY.photoReadsPerMonth : v.photoReadsPerMonth
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 1000) return { ok: false, message: "Photo reads per month must be a whole number from 0 to 1000." }
  return { ok: true, policy: { photoReadsPerMonth: n } }
}

export function listingPolicyFrom(stored: unknown): ListingPolicy {
  const r = parseListingPolicy(stored ?? {})
  return r.ok ? r.policy : DEFAULT_LISTING_POLICY
}
