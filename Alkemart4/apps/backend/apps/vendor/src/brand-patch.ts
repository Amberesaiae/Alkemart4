/**
 * Seller Hub brand scrubber + auth art.
 * Mirror admin quality: single HTML "alkemart." wordmark, no SVG text,
 * no duplicate logos, short copy. Vendor AuthLayout is form left | art right.
 */

const BAD_EXACT = /^(Medusa Store|Mercur|Medusa|MedusaJS|Medusa\.js)$/i
const BAD_CONTAINS = /medusa|mercurjs|mercur\.dev|medusajs/i
/** Paths, stacks, CLI, and other developer noise — never show to sellers */
const DEV_LEAK =
  /(\/home\/|\/Users\/|\\\\|C:\\\\|node_modules|packages\/api|src\/scripts|@mercurjs|@medusajs|bunx|medusa user|medusa (dev|start|exec)|knex|ETIMEDOUT|pg connection|stack trace|TypeError|ReferenceError|Cannot find module|Failed to resolve|CLI|webpack|vite|HMR|telemetry)/i
/** Pack-6 doorstep delivery art */
const SELLER_ART = "/seller/illustrations/auth-seller.webp"
const SELLER_ART_PNG = "/seller/illustrations/auth-seller.png"

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

  // Never use letter monogram as brand icon — hide it
  if (/^(M|a|A)$/.test(t) && el.closest("aside, nav, header")) {
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

function hideDevNoise() {
  document
    .querySelectorAll(
      "pre, code, [class*='error'], [class*='Error'], [data-sonner-toast], .Toastify, [class*='toast']",
    )
    .forEach((node) => {
      if (!(node instanceof HTMLElement)) return
      const t = node.textContent || ""
      if (!t) return
      if (DEV_LEAK.test(t) || (t.length > 140 && /error|exception|failed|stack/i.test(t))) {
        node.setAttribute("data-alk-hidden-tech", "1")
        node.style.display = "none"
      }
    })

  document.querySelectorAll("p, span, div, li").forEach((node) => {
    if (!(node instanceof HTMLElement) || !isLeaf(node)) return
    if (node.closest("form, label, button, a, input")) return
    const t = (node.textContent || "").trim()
    if (!t || t.length < 24) return
    if (DEV_LEAK.test(t)) {
      node.setAttribute("data-alk-hidden-tech", "1")
      node.style.display = "none"
    }
  })
}

function preferOperatingDefaults() {
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

function dedupeMarkers(selector: string) {
  const nodes = document.querySelectorAll(selector)
  nodes.forEach((el, i) => {
    if (i > 0) el.remove()
  })
}

/**
 * Sidebar: only hide pure letter monogram tiles (M/a/A) near the top.
 * Never restyle layout / flex of the sidebar tree.
 */
function fixSidebarBrand() {
  document
    .querySelectorAll("aside, [data-testid='sidebar']")
    .forEach((root) => {
      if (!(root instanceof HTMLElement)) return
      root.querySelectorAll("span, div").forEach((el) => {
        if (!(el instanceof HTMLElement) || !isLeaf(el)) return
        if (el.closest("nav a, form, input, [role='listbox']")) return
        const t = (el.textContent || "").replace(/\s+/g, "").trim()
        if (!/^(M|a|A)$/.test(t)) return
        const rect = el.getBoundingClientRect()
        if (rect.width < 16 || rect.width > 44 || rect.height < 16 || rect.height > 44)
          return
        if (rect.top > 120) return
        const box =
          (el.closest('[class*="rounded"]') as HTMLElement | null) || el
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
  hideDevNoise()
  preferOperatingDefaults()
  dedupeMarkers("[data-alk-login-wordmark]")
  dedupeMarkers("[data-alk-markets-onboard]")
}

/**
 * Vendor AuthLayout: form left | illustration right.
 * Point built-in art at doorstep delivery + cream panel.
 */
function enhanceSellerAuthArt() {
  const candidates = Array.from(
    document.querySelectorAll<HTMLImageElement>("img"),
  ).filter((img) => {
    const s = img.getAttribute("src") || img.src || ""
    return (
      s.includes("onboarding/illustration") ||
      s.includes("auth-seller") ||
      (img.alt === "" &&
        img.className.includes("object-cover") &&
        img.closest(".lg\\:flex, [class*='flex-1']"))
    )
  })

  let art =
    candidates.find((img) =>
      (img.getAttribute("src") || "").includes("onboarding"),
    ) ||
    candidates.find(
      (img) =>
        img.className.includes("object-cover") ||
        img.className.includes("h-full"),
    ) ||
    null

  if (!art) {
    const shell = document.querySelector(".h-dvh.w-dvw, [class*='h-dvh']")
    if (shell) {
      const imgs = Array.from(shell.querySelectorAll("img")).filter(
        (i) => !(i.getAttribute("src") || "").includes("logo"),
      )
      art = imgs[imgs.length - 1] || null
    }
  }

  if (art instanceof HTMLImageElement) {
    if (!art.src.includes("auth-seller")) {
      art.src = SELLER_ART
      art.onerror = () => {
        if (!art!.src.includes(".png")) art!.src = SELLER_ART_PNG
      }
    }
    art.alt = "Doorstep delivery"
    art.classList.add("alk-seller-auth-art")
    const panel = art.parentElement
    if (panel) {
      panel.classList.add("alk-seller-auth-art-panel")
      panel.style.background = "#faf8f2"
      // Brand on art panel (matches admin art-side lockup)
      ensureArtBrand(panel)
    }
  }

  // Hide ALL logo imgs + empty avatar wrappers in the form column
  document.querySelectorAll("img").forEach((img) => {
    if (!(img instanceof HTMLImageElement)) return
    if (img.classList.contains("alk-seller-auth-art")) return
    const s = img.getAttribute("src") || img.src || ""
    const isLogo =
      s.includes("logo") ||
      img.alt === "Mercur" ||
      img.alt === "alkemart" ||
      img.alt === "logo" ||
      img.classList.contains("alk-auth-logo-wordmark") ||
      img.classList.contains("alk-auth-logo-mark") ||
      img.getAttribute("data-alk-hide-logo") === "1"
    if (!isLogo) return
    img.style.display = "none"
    img.setAttribute("data-alk-hide-logo", "1")
    // Collapse empty rounded mark wrappers (leave form/title alone)
    let p: HTMLElement | null = img.parentElement
    for (let depth = 0; p && depth < 4; depth++, p = p.parentElement) {
      if (p.closest("[data-alk-login-art-brand], form, [data-alk-auth-footer]"))
        break
      if (p.querySelector("form, input, button, h1, h2, a[href*='reset']")) break
      const onlyLogo =
        !p.querySelector("form, input, button[type='submit'], h1, h2") &&
        (p.textContent || "").replace(/\s+/g, " ").trim().length < 24
      if (onlyLogo) {
        p.style.display = "none"
        p.setAttribute("data-alk-hide-logo-wrap", "1")
      }
    }
  })

  // Headings — short, single title
  document.querySelectorAll("h1, h2").forEach((h) => {
    if (!(h instanceof HTMLElement)) return
    const t = (h.textContent || "").trim()
    if (
      /welcome to|mercur|medusa|sell on alkemart|start selling/i.test(t) ||
      t === "Welcome back"
    ) {
      const path = window.location.pathname || ""
      if (/register|invite|sign-?up/i.test(path)) {
        h.textContent = "Create a seller account"
      } else if (/reset|forgot/i.test(path)) {
        h.textContent = "Reset password"
      } else {
        h.textContent = "Seller sign in"
      }
    }
  })

  // Shorten long hints under title
  document.querySelectorAll("p").forEach((p) => {
    if (!(p instanceof HTMLElement) || !isLeaf(p)) return
    if (p.closest("form, [data-alk-auth-footer], [data-alk-login-art-brand]"))
      return
    const t = (p.textContent || "").trim()
    if (
      /not the shopper|email and password for your seller hub/i.test(t) ||
      (t.length > 50 && /seller hub account/i.test(t))
    ) {
      p.textContent = "Products, offers, and orders for your shop."
    }
  })
}

function ensureArtBrand(panel: HTMLElement) {
  if (panel.querySelector("[data-alk-login-art-brand]")) return
  const brand = document.createElement("div")
  brand.setAttribute("data-alk-login-art-brand", "1")
  brand.className = "alk-login-art-brand-wrap"
  brand.innerHTML =
    '<div class="alk-login-art-brand">alkemart<span class="alk-dot">.</span></div>' +
    '<p class="alk-login-art-caption">Seller Hub</p>'
  panel.insertBefore(brand, panel.firstChild)
}

/**
 * Form column: one HTML wordmark lockup only (no SVG, no duplicates).
 * Drop redundant marketing / double CTAs.
 */
function organizeSellerAuth() {
  const path = window.location.pathname || ""
  const isAuthShell =
    /\/seller\/?(login|register|invite|reset|forgot)?\/?$/i.test(path) ||
    !!document.querySelector(
      "[data-testid='login-page'], form input[type='password']",
    )
  if (!isAuthShell) return

  // Remove redundant marketing paragraphs
  document.querySelectorAll("p, span, div").forEach((node) => {
    if (!(node instanceof HTMLElement) || !isLeaf(node)) return
    if (node.closest("[data-alk-auth-footer], form, button, a, label, [data-alk-login-art-brand]"))
      return
    const t = (node.textContent || "").trim()
    if (!t || t.length > 160) return
    if (
      /^sell on alkemart/i.test(t) ||
      /^manage offers,?\s*orders/i.test(t) ||
      /^manage offers/i.test(t) ||
      /shoppers use the storefront/i.test(t) ||
      (t.includes("Sell on") && t.includes("alkemart") && t.length < 40)
    ) {
      const parent = node.parentElement
      node.style.display = "none"
      node.setAttribute("data-alk-auth-noise", "1")
      if (
        parent &&
        parent.childElementCount <= 3 &&
        /sell on|manage offers|shoppers use/i.test(parent.textContent || "")
      ) {
        parent.style.display = "none"
        parent.setAttribute("data-alk-auth-noise", "1")
      }
    }
  })

  // If our footer is mounted, hide Mercur's duplicate create-account row
  const hasFooter = !!document.querySelector("[data-alk-auth-footer]")
  document.querySelectorAll("p, div, span").forEach((el) => {
    if (!(el instanceof HTMLElement)) return
    if (el.closest("[data-alk-auth-footer]")) return
    const t = (el.textContent || "").replace(/\s+/g, " ").trim()
    if (
      hasFooter &&
      /don'?t have a store/i.test(t) &&
      /create an account/i.test(t) &&
      t.length < 80
    ) {
      el.style.display = "none"
      el.setAttribute("data-alk-auth-noise", "1")
      return
    }
    if (!isLeaf(el)) return
    if (/don'?t have a store yet/i.test(t)) {
      el.textContent = "New seller?"
    }
    if (/^create an account$/i.test(t) && !hasFooter) {
      el.textContent = "Create a seller account"
    }
  })

  // Single HTML wordmark in form column (if art brand missing, keep form brand)
  const formCol =
    document.querySelector("[data-testid='login-container']") ||
    document.querySelector("form")?.parentElement
  const hasArtBrand = !!document.querySelector("[data-alk-login-art-brand]")

  if (formCol && formCol instanceof HTMLElement) {
    // Prefer art-side brand: strip all form-column lockups (widget + injects)
    if (hasArtBrand) {
      formCol
        .querySelectorAll(
          "[data-alk-login-wordmark], .alk-login-brand, [data-login-logo]",
        )
        .forEach((el) => el.remove())
      // Orphan role labels / empty mark boxes above the title
      formCol.querySelectorAll("p, span, div").forEach((el) => {
        if (!(el instanceof HTMLElement)) return
        if (el.closest("form, [data-alk-auth-footer], button, a, label, h1, h2"))
          return
        const t = (el.textContent || "").replace(/\s+/g, " ").trim()
        if (/^seller hub$/i.test(t) || t === "") {
          // Empty box or role-only node sitting above the form
          const rect = el.getBoundingClientRect()
          if (t === "" && (rect.width < 8 || rect.height < 8)) return
          if (
            /^seller hub$/i.test(t) ||
            (t === "" &&
              rect.width > 20 &&
              rect.width < 80 &&
              rect.height > 20 &&
              rect.height < 80)
          ) {
            el.style.display = "none"
            el.setAttribute("data-alk-auth-noise", "1")
          }
        }
      })
    } else {
      // Mobile / no art panel: single HTML wordmark in form column
      formCol.querySelectorAll("[data-alk-login-wordmark]").forEach((el, i) => {
        if (i > 0) el.remove()
      })
      let lockup = formCol.querySelector(
        "[data-alk-login-wordmark]",
      ) as HTMLElement | null
      if (!lockup) {
        lockup = document.createElement("div")
        lockup.className = "alk-login-brand"
        lockup.setAttribute("data-alk-login-wordmark", "1")
        lockup.innerHTML =
          '<div class="alk-login-wordmark">alkemart<span class="alk-dot">.</span></div>' +
          '<div class="alk-login-role">Seller Hub</div>'
        formCol.insertBefore(lockup, formCol.firstChild)
      } else if (lockup.querySelector("img")) {
        lockup.innerHTML =
          '<div class="alk-login-wordmark">alkemart<span class="alk-dot">.</span></div>' +
          '<div class="alk-login-role">Seller Hub</div>'
      }
    }
  }

  document.querySelectorAll("a").forEach((a) => {
    if (!(a instanceof HTMLAnchorElement)) return
    const href = a.getAttribute("href") || ""
    const t = (a.textContent || "").trim()
    if (
      /register|sign-?up|invite/i.test(href) ||
      /create a seller account|create an account/i.test(t)
    ) {
      a.classList.add("alk-auth-native-register")
    }
    if (/reset|forgot/i.test(href) || /^reset$/i.test(t)) {
      a.classList.add("alk-auth-native-reset")
    }
  })
}

function removeMarketsTips() {
  document.querySelectorAll("[data-alk-markets-onboard]").forEach((el) => {
    el.remove()
  })
}

let scrubTimer: ReturnType<typeof setTimeout> | null = null
function scheduleScrub() {
  if (scrubTimer != null) return
  scrubTimer = setTimeout(() => {
    scrubTimer = null
    scrubShell()
    enhanceSellerAuthArt()
    organizeSellerAuth()
    removeMarketsTips()
  }, 80)
}

export function startBrandPatch() {
  if (typeof window === "undefined" || typeof document === "undefined") return
  if ((window as unknown as { __alkBrandPatch?: boolean }).__alkBrandPatch)
    return
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
