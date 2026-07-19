import { cn } from "@/lib/utils"

type Props = {
  label?: string | null
  className?: string
}

/**
 * Mowafer tiny muted category above product title
 * (“Televisions”, “Mobile Phones”, “Accessories”, …).
 */
export function ProductCategoryLabel({ label, className }: Props) {
  const t = label?.trim()
  if (!t) return null
  return (
    <p
      className={cn(
        "text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs",
        className,
      )}
    >
      {t}
    </p>
  )
}
