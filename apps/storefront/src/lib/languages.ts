/**
 * Language list aligned with Seller Hub / Mercur dashboards.
 * Storefront persists preference; full UI strings remain English until catalogs land.
 */
export type AlkLanguage = {
  code: string
  display_name: string
  ltr: boolean
}

export const LANGUAGES: AlkLanguage[] = [
  { code: "ar", display_name: "العربية", ltr: false },
  { code: "bg", display_name: "Български", ltr: true },
  { code: "bs", display_name: "Bosanski", ltr: true },
  { code: "cs", display_name: "Čeština", ltr: true },
  { code: "de", display_name: "Deutsch", ltr: true },
  { code: "el", display_name: "Ελληνικά", ltr: true },
  { code: "en", display_name: "English", ltr: true },
  { code: "es", display_name: "Español", ltr: true },
  { code: "fa", display_name: "فارسی", ltr: false },
  { code: "fr", display_name: "Français", ltr: true },
  { code: "he", display_name: "עברית", ltr: false },
  { code: "hu", display_name: "Magyar", ltr: true },
  { code: "id", display_name: "Bahasa Indonesia", ltr: true },
  { code: "it", display_name: "Italiano", ltr: true },
  { code: "ja", display_name: "日本語", ltr: true },
  { code: "ko", display_name: "한국어", ltr: true },
  { code: "lt", display_name: "Lietuviškai", ltr: true },
  { code: "mk", display_name: "Македонски", ltr: true },
  { code: "mn", display_name: "Монгол", ltr: true },
  { code: "nl", display_name: "Nederlands", ltr: true },
  { code: "pl", display_name: "Polski", ltr: true },
  { code: "ptBR", display_name: "Português (Brasil)", ltr: true },
  { code: "ptPT", display_name: "Português (Portugal)", ltr: true },
  { code: "ro", display_name: "Română", ltr: true },
  { code: "ru", display_name: "Русский", ltr: true },
  { code: "th", display_name: "ไทย", ltr: true },
  { code: "tr", display_name: "Türkçe", ltr: true },
  { code: "uk", display_name: "Українська", ltr: true },
  { code: "vi", display_name: "Tiếng Việt", ltr: true },
  { code: "zhCN", display_name: "简体中文", ltr: true },
  { code: "zhTW", display_name: "繁體中文(臺灣)", ltr: true },
]

export const LNG_STORAGE_KEY = "lng"

export function readStoredLanguage(): string {
  try {
    const v = localStorage.getItem(LNG_STORAGE_KEY)
    if (v && LANGUAGES.some((l) => l.code === v)) return v
  } catch {
    /* ignore */
  }
  return "en"
}

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.display_name ?? "English"
}

export function applyLanguage(code: string) {
  try {
    localStorage.setItem(LNG_STORAGE_KEY, code)
  } catch {
    /* ignore */
  }
  document.cookie = `lng=${encodeURIComponent(code)}; path=/; max-age=31536000; SameSite=Lax`
  const lang = LANGUAGES.find((l) => l.code === code)
  document.documentElement.lang = code.startsWith("zh")
    ? code === "zhTW"
      ? "zh-TW"
      : "zh-CN"
    : code
  document.documentElement.dir = lang && !lang.ltr ? "rtl" : "ltr"
  window.dispatchEvent(
    new CustomEvent("alkemart:language", { detail: { code } }),
  )
}
