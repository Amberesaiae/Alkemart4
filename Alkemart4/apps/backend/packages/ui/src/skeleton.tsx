import { cn } from "./cn"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-muted", className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }
