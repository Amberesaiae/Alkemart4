import { cn } from "@workspace/ui"

function SkipLink({ className }: { className?: string }) {
  return (
    <a
      href="#main"
      className={cn(
        "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-primary-foreground",
        className,
      )}
    >
      Skip to content
    </a>
  )
}
export { SkipLink }
