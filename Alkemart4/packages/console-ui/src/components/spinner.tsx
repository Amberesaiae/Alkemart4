import { cn } from "cn"
import { BrandSpinner } from "./brand-spinner"

function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <BrandSpinner className={cn("size-4", className)} {...props} />
  )
}

export { Spinner }
