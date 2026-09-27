import { Link } from "@tanstack/react-router"

/** Wordmark on ink (sidebar) or white (phone top bar), with the product name. */
export function Brand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-lg" aria-label="alkemart for sellers — home">
      <img
        src={tone === "light" ? "/brand/alkemart-logo-light.webp" : "/brand/alkemart-logo-primary.webp"}
        alt=""
        className="h-7 w-auto"
        width={84}
        height={28}
      />
      <span
        className={
          tone === "light"
            ? "rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white"
            : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold"
        }
      >
        Sellers
      </span>
    </Link>
  )
}
