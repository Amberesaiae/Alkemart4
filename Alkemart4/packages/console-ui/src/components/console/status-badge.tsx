import { cn } from "cn"
import { statusLabel, type Audience, type StatusKind, type Tone } from "@workspace/console-ui/lib/status"

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-foreground",
  brand: "bg-brand text-brand-foreground",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-destructive",
}

/** Text + colour, never colour alone (WCAG 1.4.1). */
export function StatusBadge({
  kind,
  status,
  audience,
  className,
}: {
  kind: StatusKind
  status: string
  audience: Audience
  className?: string
}) {
  const { label, tone } = statusLabel(kind, status, audience)
  return <ToneBadge tone={tone} className={className}>{label}</ToneBadge>
}

export function ToneBadge({ tone, className, children }: { tone: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
