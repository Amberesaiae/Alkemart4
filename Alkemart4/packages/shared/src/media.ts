/**
 * Uploaded photos live at `/media/{kind}/{owner}/{uuid}.webp` (or the same
 * key on the public media domain, MEDIA_PUBLIC_URL), with a 400px
 * `{uuid}.thumb.webp` beside them (apps/api/src/routes/vendor/uploads.ts).
 * Grids and cards use the thumb so a page of products costs kilobytes, not
 * megabytes, on mobile data. Anything else (originals, pasted URLs) is
 * returned unchanged. Callers fall back to the full image if a thumb is
 * missing — the Images binding can fail for one size and not the other.
 */
// `/media/…` on the API, or the same key on the public media domain.
const WEB_VARIANT = /(\/(?:media\/)?(?:products|logos|banners|merch)\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)\.webp$/

export function thumbOf(url: string | null | undefined): string | null {
  if (!url) return null
  return url.replace(WEB_VARIANT, "$1.thumb.webp")
}

/** `onError` for a thumb `<img>`: swap to the full photo once, then give up. */
export function thumbFallback(full: string | null | undefined) {
  return (e: { currentTarget: HTMLImageElement }) => {
    const img = e.currentTarget
    if (full && img.getAttribute("src") !== full) img.src = full
  }
}
