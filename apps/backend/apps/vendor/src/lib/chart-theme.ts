/** Shared Recharts tokens — alkemart yellow/black (accessible on white). */

export const CHART = {
  yellow: "#f5c518",
  yellowSoft: "#fff8d6",
  black: "#141414",
  gray: "#8a8a8a",
  border: "#e6e6e2",
  grid: "#f0f0ee",
  series: ["#141414", "#f5c518", "#5c5c5c", "#c9a200", "#2a2a2a"],
  tooltip: {
    backgroundColor: "#ffffff",
    border: "1px solid #e6e6e2",
    borderRadius: 8,
    fontSize: 12,
    color: "#141414",
  },
} as const

export function formatGhs(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

export function shortDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z")
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
