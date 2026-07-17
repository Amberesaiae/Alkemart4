/**
 * Global shell brand scrubber — Seller Hub.
 */
const BAD_EXACT = /^(Medusa Store|Mercur|Medusa)$/i

function scrub() {
  document.querySelectorAll("aside *, nav *, header *").forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    if (node.childElementCount > 0) return
    const t = (node.textContent || "").trim()
    if (!t || t.length > 48) return
    if (BAD_EXACT.test(t)) {
      node.textContent = "alkemart"
      node.style.fontWeight = "800"
    }
    if (t === "M") {
      node.textContent = "a"
      node.style.color = "#f5c518"
      node.style.fontWeight = "800"
      node.style.background = "#141414"
    }
  })
  if (/medusa|mercur/i.test(document.title)) {
    document.title = document.title
      .replace(/medusa/gi, "alkemart")
      .replace(/mercur/gi, "alkemart")
  }
}

export function startBrandPatch() {
  if (typeof window === "undefined" || typeof document === "undefined") return
  scrub()
  const mo = new MutationObserver(() => scrub())
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  })
  window.setInterval(scrub, 1500)
}
