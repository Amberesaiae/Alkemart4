import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Facebook02Icon, InstagramIcon, TiktokIcon } from "@hugeicons/core-free-icons"
import { socialHandle, type SocialKind } from "@alkemart/domain"
import { cn } from "@/lib/utils"

const PLATFORMS: { kind: Exclude<SocialKind, "whatsapp">; label: string; icon: IconSvgElement }[] = [
  { kind: "tiktok", label: "TikTok", icon: TiktokIcon },
  { kind: "instagram", label: "Instagram", icon: InstagramIcon },
  { kind: "facebook", label: "Facebook", icon: Facebook02Icon },
]

/**
 * Where else buyers can see this shop. A real following on TikTok or
 * Instagram is one of the strongest trust signals a new shop has, so the
 * links sit with the shop name, show the handle, and only ever point at the
 * platforms' own domains (the API normalises and allow-lists them).
 */
export function ShopSocials({
  social,
  className,
}: {
  social: Partial<Record<SocialKind, string>>
  className?: string
}) {
  const links = PLATFORMS.filter((p) => social[p.kind])
  if (!links.length) return null
  return (
    <ul aria-label="Find this shop on" className={cn("flex flex-wrap gap-2", className)}>
      {links.map((p) => (
        <li key={p.kind}>
          <a
            href={social[p.kind]}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm font-semibold hover:bg-muted"
          >
            <HugeiconsIcon icon={p.icon} className="size-4" aria-hidden />
            <span className="sr-only">{p.label}: </span>
            {socialHandle(p.kind, social[p.kind]!)}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
