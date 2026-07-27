import { AlertTriangle } from "lucide-react"
import { cn } from "@workspace/ui"

interface ErrorAlertProps {
  message: string
  className?: string
  onRetry?: () => void
}

function ErrorAlert({ message, className, onRetry }: ErrorAlertProps) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg bg-destructive/10 p-4 text-destructive border border-destructive/20", className)}>
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <p className="text-sm font-semibold flex-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-bold underline hover:no-underline">
          Retry
        </button>
      )}
    </div>
  )
}
export { ErrorAlert }
