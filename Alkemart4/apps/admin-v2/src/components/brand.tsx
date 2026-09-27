import { Link } from "@tanstack/react-router"

export function Brand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-lg" aria-label="alkemart admin — overview">
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
            ? "rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-brand-foreground"
            : "rounded-full bg-foreground px-2 py-0.5 text-xs font-bold text-background"
        }
      >
        Admin
      </span>
    </Link>
  )
}
