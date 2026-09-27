import { cn } from "@/lib/utils"

/**
 * Shop identity: the shop's own logo when it has one, else a monogram on a
 * colour derived from the name (stable per shop, never a stock photo).
 */
const GROUNDS = ["#111114", "#2f5bff", "#9b6cff", "#e0245e", "#067647", "#b54708", "#0e7490"]

function groundFor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return GROUNDS[h % GROUNDS.length]!
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : name.slice(0, 2)).toUpperCase()
}

export function SellerAvatar({
  name,
  logo,
  size = "md",
  className,
}: {
  name: string
  logo?: string | null
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}) {
  const box = cn(
    "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white ring-2 ring-background",
    size === "sm" && "size-7 text-[10px]",
    size === "md" && "size-10 text-xs",
    size === "lg" && "size-14 text-sm",
    size === "xl" && "size-20 text-lg",
    className,
  )
  if (logo) {
    return (
      <span className={cn(box, "bg-white")}>
        <img src={logo} alt="" className="size-full object-cover" loading="lazy" />
      </span>
    )
  }
  return (
    <span className={box} style={{ background: groundFor(name) }} aria-hidden>
      {initials(name)}
    </span>
  )
}
