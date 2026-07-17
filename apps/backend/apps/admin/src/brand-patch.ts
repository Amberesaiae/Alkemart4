/**
 * Global shell brand scrubber — runs on every panel page (not zone-limited).
 * Replaces residual "Medusa Store" / "M" chrome with alkemart without forking.
 * Also upgrades the login mark (Mercur login has no widget zones).
 */

const BAD_EXACT = /^(Medusa Store|Mercur|Medusa)$/i
const LOGO_SRC = "/dashboard/logo.svg"

function scrubShell() {
  document.querySelectorAll("aside *, nav *, header *").forEach((node) => {
    if (!(node instanceof HTMLElement)) return
    // Only leaf-ish text nodes
    if (node.childElementCount > 0) return
    const t = (node.textContent || "").trim()
    if (!t || t.length > 48) return
    if (BAD_EXACT.test(t)) {
      node.textContent = "alkemart"
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

/**
 * Login page: Mercur AvatarBox only shows a 50×50 img from config.logo.
 * Ensure src is the public asset, enlarge the mark, and add the wordmark.
 */
function enhanceLoginBrand() {
  const page = document.querySelector('[data-testid="login-page"]')
  if (!(page instanceof HTMLElement)) return

  const img =
    page.querySelector<HTMLImageElement>('img[alt="alkemart"], img[alt="Mercur"]') ||
    page.querySelector<HTMLImageElement>("img")

  if (img) {
    if (!img.src.includes("/logo.svg") || img.src.includes("/home/")) {
      img.src = LOGO_SRC
    }
    img.alt = "alkemart"
    img.removeAttribute("width")
    img.removeAttribute("height")
    img.style.width = "100%"
    img.style.height = "100%"
    img.style.objectFit = "contain"
    img.style.borderRadius = "14px"
  }

  // Enlarge / quiet the default AvatarBox chrome
  const avatar =
    (img?.closest('[class*="rounded-xl"]') as HTMLElement | null) ||
    (page.querySelector('[data-testid="login-container"] > div') as HTMLElement | null)

  if (avatar && !avatar.dataset.alkLogoSized) {
    avatar.dataset.alkLogoSized = "1"
    avatar.style.width = "72px"
    avatar.style.height = "72px"
    avatar.style.minWidth = "72px"
    avatar.style.minHeight = "72px"
    avatar.style.borderRadius = "18px"
    avatar.style.background = "transparent"
    avatar.style.boxShadow = "none"
    avatar.style.marginBottom = "0"
    // kill gradient pseudo chrome if present
    avatar.classList.add("alk-login-mark")
  }

  // Wordmark under the mark (once) — title/hint come from i18n (not repeated here)
  const container = page.querySelector('[data-testid="login-container"]')
  if (container instanceof HTMLElement && !container.querySelector("[data-alk-login-wordmark]")) {
    const wrap = document.createElement("div")
    wrap.setAttribute("data-alk-login-wordmark", "1")
    wrap.setAttribute("data-login-logo", "1")
    wrap.innerHTML = `
      <div class="alk-login-brand">
        <div class="alk-login-wordmark">alkemart<span class="alk-dot">.</span></div>
        <div class="alk-login-role">Admin console</div>
      </div>
    `
    const header = container.querySelector('[data-testid="login-header"]')
    if (header) {
      container.insertBefore(wrap, header)
    } else if (avatar?.parentElement === container) {
      avatar.insertAdjacentElement("afterend", wrap)
    } else {
      container.prepend(wrap)
    }
  }

  // Scrub residual Mercur marketing titles if i18n missed them
  const title = page.querySelector('[data-testid="login-title"]')
  if (title instanceof HTMLElement) {
    const t = (title.textContent || "").trim()
    if (/mercur|medusa/i.test(t) || /^Welcome to alkemart$/i.test(t)) {
      title.textContent = "Welcome back"
    }
  }
  const hint = page.querySelector('[data-testid="login-hint"]')
  if (hint instanceof HTMLElement) {
    const t = (hint.textContent || "").trim()
    if (/mercur|medusa|Sign in to access Admin|Sign in to manage/i.test(t)) {
      hint.textContent = "Manage sellers, orders, and marketplace settings."
    }
  }
}

function scrub() {
  scrubShell()
  enhanceLoginBrand()
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
