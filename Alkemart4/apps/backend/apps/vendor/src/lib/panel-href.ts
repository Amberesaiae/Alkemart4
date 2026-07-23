/** Build paths under the panel base (e.g. /dashboard or /seller). */
export function panelHref(path: string): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/")
  const p = path.replace(/^\//, "")
  return `${base}${p}`
}
