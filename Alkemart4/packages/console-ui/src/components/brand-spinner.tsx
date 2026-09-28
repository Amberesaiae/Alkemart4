import type { ComponentProps } from "react"
import { cn } from "cn"
import mark from "../assets/alkemart-mark.png"
import "../styles/brand-loading.css"

/** One fixed five-part loading mark for storefront, seller and admin surfaces. */
export function BrandSpinner({ className, label = "Loading", ...props }: ComponentProps<"span"> & { label?: string }) {
  return (
    <span data-slot="spinner" role="status" aria-label={label} className={cn("inline-grid size-10 shrink-0 place-items-center", className)} {...props}>
      <span className="brand-loading-mark" aria-hidden="true">
        <img className="brand-loading-base" src={mark} alt="" />
        {["coral", "violet", "teal", "blue", "head"].map((part) => (
          <img key={part} className={`brand-loading-petal brand-loading-petal--${part}`} src={mark} alt="" />
        ))}
      </span>
    </span>
  )
}
