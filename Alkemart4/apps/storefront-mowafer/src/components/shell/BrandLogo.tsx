import { Link } from "@tanstack/react-router"
import { brand } from "@/design/brand"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  size?: "sm" | "md" | "lg"
  linked?: boolean
  onDark?: boolean
}

/** Yellow tile + alkemart. wordmark. */
export function BrandLogo({ className, size = "md", linked = true, onDark = false }: Props) {
  const typeClass =
    size === "lg" ? "text-2xl sm:text-3xl" : size === "sm" ? "text-lg" : "text-xl sm:text-2xl"
  const tile =
    size === "lg" ? "size-10 text-lg" : size === "sm" ? "size-7 text-sm" : "size-8 text-base"

  const mark = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-primary font-extrabold text-primary-foreground",
          tile,
        )}
        aria-hidden
      >
        a
      </span>
      <span
        className={cn(
          "font-extrabold leading-none tracking-tight",
          typeClass,
          onDark ? "text-white" : "text-foreground",
        )}
      >
        {brand.name}
        <span className="text-primary">.</span>
      </span>
    </span>
  )

  if (!linked) {
    return (
      <span aria-label={brand.name} className="inline-flex items-center">
        {mark}
      </span>
    )
  }

  return (
    <Link to="/" className="inline-flex shrink-0 items-center" aria-label={`${brand.name} home`}>
      {mark}
    </Link>
  )
}
