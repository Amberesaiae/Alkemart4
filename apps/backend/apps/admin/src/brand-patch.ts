/**
 * Global shell brand scrubber — runs on every panel page (not zone-limited).
 * Replaces residual "Medusa Store" / "M" chrome with alkemart without forking.
 */
const BAD_EXACT = /^(Medusa Store|Mercur|Medusa)$/i

function scrub() {
  document.querySelectorAll("aside *, nav *, header *").forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    // Only leaf-ish text nodes
    if (node.childElementCount > 0) return
    const t = (node.textContent || "").trim()
    if (!t || t.length > 48) return
    if (BAD_EXACT.test(t)) {
      node.textContent = t.toLowerCase().includes("store") ? "alkemart" : "alkemart"
      node.style.fontWeight = "800"
      node.style.letterSpacing = "-0.03em"
    }
    if (t === "M") {
      node.textContent = "a"
      node.style.color = "#f5c518"
      node.style.fontWeight = "800"
      node.style.background = "#141414"
    }
  })

  // Concatenated "MMedusa Store" text parents
  document.querySelectorAll("aside, nav").forEach((root) => {
    root.querySelectorAll("div, span, a, button").forEach((el) => {
      if (!(el instanceof HTMLElement)) return
      const t = (el.textContent || "").trim()
      if (/M\s*Medusa Store/i.test(t) && el.childElementCount <= 3) {
        // rewrite child leaves already handled; also set title
        el.setAttribute("data-alk-branded", "1")
      }
    })
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
  // Re-run after route transitions
  window.setInterval(scrub, 1500)
}
