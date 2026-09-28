import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/utils"
export { BrandSpinner } from "@workspace/console-ui/components/brand-spinner"

/** Raster-only pinwheel crop used where the standalone mark is needed. */
export function BrandIcon({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block aspect-square overflow-hidden", className)} aria-hidden="true">
      <img
        src="/brand/alkemart-mark.png"
        alt=""
        className="absolute inset-0 size-full object-contain"
      />
    </span>
  )
}

/**
 * The complete lockup is a generated transparent PNG, with light and dark
 * wordmark versions for use on the storefront's two header surfaces.
 */
export function BrandLogo({
  className,
  tone = "dark",
  size = "md",
  asLink = true,
  hero = false,
}: {
  className?: string
  tone?: "dark" | "light"
  size?: "sm" | "md" | "lg"
  asLink?: boolean
  /** Use a white wordmark at desktop widths, where the home header is dark. */
  hero?: boolean
}) {
  const body = (
    <picture className={cn("inline-flex shrink-0", className)}>
      {tone === "light" || hero ? (
        <source
          media={hero ? "(min-width: 1024px)" : undefined}
          srcSet="/brand/alkemart-logo-light.png"
        />
      ) : null}
      <img
        src={tone === "light" ? "/brand/alkemart-logo-light.png" : "/brand/alkemart-logo-primary.png"}
        alt="alkemart"
        className={cn("h-auto w-auto object-contain", size === "sm" ? "h-10" : size === "md" ? "h-14" : "h-16")}
      />
    </picture>
  )
  if (!asLink) return body
  return (
    <Link to="/" aria-label="alkemart home" className="rounded-lg">
      {body}
    </Link>
  )
}
