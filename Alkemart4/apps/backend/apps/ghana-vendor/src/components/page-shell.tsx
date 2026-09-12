import { cn } from "@workspace/ui"

interface PageShellProps {
  children: React.ReactNode
  className?: string
}

function PageShell({ children, className }: PageShellProps) {
  return <div className={cn("p-5 sm:p-6 max-w-7xl mx-auto space-y-6", className)}>{children}</div>
}

export { PageShell }
