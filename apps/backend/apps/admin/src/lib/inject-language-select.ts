/**
 * Seller-style language control for Admin login.
 * Mirrors Mercur AuthLanguageSelect (globe + label + dropdown).
 * Persists via the same lng cookie/localStorage keys Medusa uses.
 */
import {
  LANGUAGES,
  languageLabel,
  persistLanguage,
  readStoredLanguage,
} from "./languages"

function globeSvg(): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>`
}

function applyLanguage(code: string) {
  const current = readStoredLanguage()
  if (code === current) return
  persistLanguage(code)

  // Prefer in-app i18n change (no full reload) when react-i18next is live.
  // Fall back to reload so lng cookie/localStorage is applied on next boot.
  type I18nLike = { changeLanguage?: (c: string) => Promise<unknown> | void }
  const candidates: I18nLike[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (w.i18n?.changeLanguage) candidates.push(w.i18n)
    if (w.__i18n?.changeLanguage) candidates.push(w.__i18n)
  } catch {
    /* ignore */
  }

  const tryChange = async () => {
    for (const i18n of candidates) {
      try {
        await i18n.changeLanguage?.(code)
        // Update visible label without reload
        const label = document.querySelector(
          "[data-alk-lang-select] .alk-lang-label",
        )
        if (label) {
          const { languageLabel } = await import("./languages")
          label.textContent = languageLabel(code)
        }
        document
          .querySelectorAll("[data-alk-lang-select] .alk-lang-option")
          .forEach((el) => {
            const btn = el as HTMLElement
            const active = btn.getAttribute("data-code") === code
            btn.classList.toggle("is-active", active)
            btn.setAttribute("aria-selected", active ? "true" : "false")
          })
        return true
      } catch {
        /* try next */
      }
    }
    return false
  }

  void tryChange().then((ok) => {
    if (!ok) window.location.reload()
  })
}

/**
 * Mount language select on admin login form column (top-right),
 * matching seller AuthLayout placement.
 */
export function injectAdminLanguageSelect(page: HTMLElement) {
  if (page.querySelector("[data-alk-lang-select]")) return

  const formCol =
    (page.querySelector('[data-testid="login-container"]')
      ?.parentElement as HTMLElement | null) ||
    (page.querySelector('[data-testid="login-container"]') as HTMLElement | null) ||
    page

  // Prefer a dedicated host at top of form column
  let host = page.querySelector("[data-alk-lang-host]") as HTMLElement | null
  if (!host) {
    host = document.createElement("div")
    host.setAttribute("data-alk-lang-host", "1")
    host.className = "alk-lang-host"
    // Insert as first child of form column area
    const formSide =
      (page.querySelector(".alk-login-form-col") as HTMLElement | null) ||
      (page.querySelector('[data-testid="login-container"]')
        ?.parentElement as HTMLElement | null) ||
      formCol
    if (formSide && formSide !== page) {
      formSide.insertBefore(host, formSide.firstChild)
    } else {
      // Absolute overlay on page
      page.appendChild(host)
      host.classList.add("alk-lang-host-overlay")
    }
  }

  const current = readStoredLanguage()
  const sorted = [...LANGUAGES].sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  )

  const root = document.createElement("div")
  root.setAttribute("data-alk-lang-select", "1")
  root.className = "alk-lang-select"
  root.innerHTML = `
    <button type="button" class="alk-lang-trigger" data-alk-lang-trigger data-testid="auth-language-select-trigger" aria-haspopup="listbox" aria-expanded="false">
      ${globeSvg()}
      <span class="alk-lang-label">${languageLabel(current)}</span>
    </button>
    <div class="alk-lang-menu" data-alk-lang-menu hidden role="listbox" aria-label="Language">
      ${sorted
        .map(
          (l) =>
            `<button type="button" role="option" class="alk-lang-option${l.code === current ? " is-active" : ""}" data-code="${l.code}" data-testid="auth-language-select-option-${l.code}" aria-selected="${l.code === current}">${l.display_name}</button>`,
        )
        .join("")}
    </div>
  `

  const trigger = root.querySelector(
    "[data-alk-lang-trigger]",
  ) as HTMLButtonElement
  const menu = root.querySelector("[data-alk-lang-menu]") as HTMLElement

  function close() {
    menu.hidden = true
    trigger.setAttribute("aria-expanded", "false")
  }
  function open() {
    menu.hidden = false
    trigger.setAttribute("aria-expanded", "true")
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation()
    if (menu.hidden) open()
    else close()
  })

  menu.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(
      "[data-code]",
    ) as HTMLElement | null
    if (!btn) return
    e.preventDefault()
    e.stopPropagation()
    const code = btn.getAttribute("data-code") || "en"
    close()
    applyLanguage(code)
  })

  document.addEventListener(
    "click",
    (e) => {
      if (!root.contains(e.target as Node)) close()
    },
    true,
  )

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close()
  })

  host.appendChild(root)
  persistLanguage(current) // sync html lang/dir
}
