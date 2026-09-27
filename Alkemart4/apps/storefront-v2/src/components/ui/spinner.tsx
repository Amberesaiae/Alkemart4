import { cn } from "cn"
import { BrandSpinner } from "@/components/brand/brand-logo"

function Spinner({ className }: { className?: string }) {
  return <BrandSpinner className={cn("size-4", className)} label="Loading" />
}

export { Spinner }
