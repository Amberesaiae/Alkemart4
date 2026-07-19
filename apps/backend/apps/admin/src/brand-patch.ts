/**
 * Admin brand scrubber + login split.
 * Admin login is a centered card (data-testid=login-page) — we rebuild into
 * split: cream art panel (headset) | spacious form.
 * Language select mirrors Seller Hub AuthLanguageSelect.
 */

import { injectAdminLanguageSelect } from "./lib/inject-language-select"

const BAD_EXACT = /^(Medusa Store|Mercur|Medusa|MedusaJS|Medusa\.js)$/i
const BAD_CONTAINS = /medusa|mercurjs|mercur\.dev|medusajs/i
const PATH_LEAK =
  /(\/home\/|\/Users\/|\\\\|C:\\\\|node_modules|packages\/api|src\/scripts|@mercurjs|@medusajs)/i
const LOGO_SRC = "/dashboard/logo.svg"
/** Pack-6 imgi_171 headset / support */
const LOGIN_ART = "/dashboard/illustrations/auth-admin.webp"
const LOGIN_ART_PNG = "/dashboard/illustrations/auth-admin.png"

function isLeaf(el: HTMLElement): boolean {
  return el.childElementCount === 0
}

function scrubTextNode(el: HTMLElement) {
  const t = (el.textContent || "").trim()
  if (!t || t.length > 120) return

  if (BAD_EXACT.test(t)) {
    el.textContent = "alkemart"
    el.style.fontWeight = "800"
    el.style.letterSpacing = "-0.03em"
    return
  }

  if (
    /^(M|a|A)$/.test(t) &&
    el.closest("aside, nav, header, [data-testid='login-page']")
  ) {
    const box =
      (el.closest('[class*="rounded"]') as HTMLElement | null) || el
    box.style.display = "none"
    box.setAttribute("data-alk-hide-monogram", "1")
    return
  }

  if (BAD_CONTAINS.test(t) && t.length < 80) {
    el.textContent = t
      .replace(/medusajs/gi, "alkemart")
      .replace(/medusa\.js/gi, "alkemart")
      .replace(/medusa/gi, "alkemart")
      .replace(/mercurjs/gi, "alkemart")
      .replace(/mercur\.dev/gi, "alkemart.local")
      .replace(/mercur/gi, "alkemart")
  }
}

function hidePathLeaks() {
  document
    .querySelectorAll("pre, code, [class*='error'], [role='alert']")
    .forEach((node) => {
      if (!(node instanceof HTMLElement)) return
      const t = node.textContent || ""
      if (
        (PATH_LEAK.test(t) || /Failed to resolve|Cannot find module|stack/i.test(t)) &&
        (t.length > 160 || PATH_LEAK.test(t))
      ) {
        node.setAttribute("data-alk-hidden-tech", "1")
        node.style.display = "none"
      }
    })
}

function preferGhsCurrencySelects() {
  document.querySelectorAll("select").forEach((sel) => {
    if (!(sel instanceof HTMLSelectElement)) return
    if (sel.dataset.alkDefaulted === "1") return
    const ghs = [...sel.options].find((o) => o.value.toLowerCase() === "ghs")
    if (!ghs) return
    const v = (sel.value || "").toLowerCase()
    if (!v || v === "eur" || v === "usd") {
      sel.value = ghs.value
      sel.dataset.alkDefaulted = "1"
      sel.dispatchEvent(new Event("change", { bubbles: true }))
    } else {
      sel.dataset.alkDefaulted = "1"
    }
  })
}

function dedupeMarkers(attr: string) {
  const nodes = document.querySelectorAll(`[${attr}]`)
  nodes.forEach((el, i) => {
    if (i > 0) el.remove()
  })
}

/**
 * Sidebar: only hide pure letter monogram tiles (M/a/A), never restyle layout.
 * scrubTextNode already renames Medusa/Mercur → alkemart.
 */
function fixSidebarBrand() {
  document
    .querySelectorAll("aside, [data-testid='sidebar']")
    .forEach((root) => {
      if (!(root instanceof HTMLElement)) return
      // Only walk the top header strip (first ~80px of sidebar), not whole nav
      root.querySelectorAll("span, div").forEach((el) => {
        if (!(el instanceof HTMLElement) || !isLeaf(el)) return
        if (el.closest("nav a, form, input, [role='listbox']")) return
        const t = (el.textContent || "").replace(/\s+/g, "").trim()
        if (!/^(M|a|A)$/.test(t)) return
        const rect = el.getBoundingClientRect()
        // Must be small tile near top of sidebar
        if (rect.width < 16 || rect.width > 44 || rect.height < 16 || rect.height > 44)
          return
        if (rect.top > 120) return
        const box =
          (el.closest('[class*="rounded"]') as HTMLElement | null) || el
        // Never hide something that contains a nav link
        if (box.querySelector("a[href], nav, svg")) return
        box.style.display = "none"
        box.setAttribute("data-alk-hide-monogram", "1")
      })
    })
}

function scrubShell() {
  document
    .querySelectorAll("aside *, nav *, header *, main *, [data-testid], body *")
    .forEach((node) => {
      if (!(node instanceof HTMLElement) || !isLeaf(node)) return
      scrubTextNode(node)
    })

  if (/medusa|mercur/i.test(document.title)) {
    document.title = document.title
      .replace(/medusajs/gi, "alkemart")
      .replace(/medusa/gi, "alkemart")
      .replace(/mercur/gi, "alkemart")
  }

  fixSidebarBrand()
  hidePathLeaks()
  preferGhsCurrencySelects()
  dedupeMarkers("data-alk-login-wordmark")
}

function enhanceLoginBrand() {
  const page = document.querySelector('[data-testid="login-page"]')
  if (!(page instanceof HTMLElement)) return

  // Hide monogram / avatar box
  page
    .querySelectorAll(
      '[data-testid="login-container"] > div[class*="rounded"], .alk-login-mark',
    )
    .forEach((el) => {
      if (el instanceof HTMLElement && !el.querySelector("form, input")) {
        // keep container structure; hide pure avatar wrappers
        if (el.querySelector("img") || el.childElementCount <= 2) {
          const onlyImgOrText = !el.querySelector("form, input, button[type=submit]")
          if (onlyImgOrText && el !== page.querySelector('[data-testid="login-container"]')) {
            // don't hide header
            if (!el.querySelector('[data-testid="login-title"]')) {
              el.style.display = "none"
            }
          }
        }
      }
    })

  // Hide logo img in form column (wordmark on art side)
  page.querySelectorAll("img").forEach((img) => {
    if (!(img instanceof HTMLImageElement)) return
    if (img.classList.contains("alk-login-art-img")) return
    const s = img.src || ""
    if (s.includes("logo") || img.alt === "Mercur" || img.alt === "alkemart") {
      img.style.display = "none"
    }
  })

  injectLoginIllustration(page)

  const title = page.querySelector('[data-testid="login-title"]')
  if (title instanceof HTMLElement) title.textContent = "Admin sign in"
  const hint = page.querySelector('[data-testid="login-hint"]')
  if (hint instanceof HTMLElement) {
    hint.textContent = "Sellers, orders, and markets."
  }

  injectAdminLanguageSelect(page)
}

function injectLoginIllustration(page: HTMLElement) {
  page.classList.add("alk-login-split")
  page.setAttribute("data-alk-login-role", "admin")

  let panel = page.querySelector("[data-alk-login-art]") as HTMLElement | null
  if (!panel) {
    panel = document.createElement("div")
    panel.setAttribute("data-alk-login-art", "1")
    panel.className = "alk-login-art-panel"
    panel.innerHTML = `
      <div class="alk-login-art-brand">alkemart<span class="alk-dot">.</span></div>
      <p class="alk-login-art-caption">Admin</p>
      <img class="alk-login-art-img" src="${LOGIN_ART}" alt="Support" width="450" height="450" decoding="async" />
    `
    const img = panel.querySelector("img") as HTMLImageElement | null
    if (img) {
      img.onerror = () => {
        img.src = LOGIN_ART_PNG
      }
    }
    page.insertBefore(panel, page.firstChild)
  } else {
    const img = panel.querySelector("img.alk-login-art-img") as HTMLImageElement | null
    if (img && !img.src.includes("auth-admin")) {
      img.src = LOGIN_ART
    }
  }

  // Ensure form column wrapper exists for CSS targeting
  const container = page.querySelector('[data-testid="login-container"]')
  if (container instanceof HTMLElement) {
    container.classList.add("alk-login-form-col")
  }
}

let scrubTimer: ReturnType<typeof setTimeout> | null = null
function scheduleScrub() {
  if (scrubTimer != null) return
  scrubTimer = setTimeout(() => {
    scrubTimer = null
    scrubShell()
    enhanceLoginBrand()
  }, 80)
}

export function startBrandPatch() {
  if (typeof window === "undefined" || typeof document === "undefined") return
  if ((window as unknown as { __alkBrandPatch?: boolean }).__alkBrandPatch) return
  ;(window as unknown as { __alkBrandPatch?: boolean }).__alkBrandPatch = true

  scheduleScrub()
  const mo = new MutationObserver(() => scheduleScrub())
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  })
  window.setInterval(scheduleScrub, 3000)
}
