import { cn } from "./cn"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("merch-shimmer animate-pulse rounded-lg bg-muted/60", className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }
