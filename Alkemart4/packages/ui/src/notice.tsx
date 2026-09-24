import * as React from "react"
import { cn } from "./cn"
import type { BadgeTone } from "./badge"

/**
 * Notice — the single canonical banner for alerts, errors, and callouts.
 *
 * Structure is fixed: optional icon, 14px bold title, 13px body, optional
 * action row. Tone comes from the AA-tested ramp (opaque soft backgrounds,
 * ink text) — never alpha washes, never raw hues. rounded-lg: notices are
 * surfaces, not pills. No motion, ever.
 */
const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-tone-neutral-ink/25 bg-tone-neutral-soft text-tone-neutral-ink",
  brand: "border-tone-brand-ink/25 bg-tone-brand-soft text-tone-brand-ink",
  success: "border-tone-success-ink/25 bg-tone-success-soft text-tone-success-ink",
  warning: "border-tone-warning-ink/25 bg-tone-warning-soft text-tone-warning-ink",
  danger: "border-tone-danger-ink/25 bg-tone-danger-soft text-tone-danger-ink",
  info: "border-tone-info-ink/25 bg-tone-info-soft text-tone-info-ink",
  scarce: "border-tone-scarce-ink/25 bg-tone-scarce-soft text-tone-scarce-ink",
}

export interface NoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: BadgeTone
  title: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

const Notice = React.forwardRef<HTMLDivElement, NoticeProps>(
  ({ className, tone = "neutral", title, icon, action, children, role, ...props }, ref) => (
    <div
      ref={ref}
      role={role ?? (tone === "danger" ? "alert" : "status")}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3.5 text-sm",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {icon ? <span className="mt-0.5 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug">{title}</p>
        {children ? <div className="mt-0.5 text-[13px] leading-relaxed opacity-90">{children}</div> : null}
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
    </div>
  ),
)
Notice.displayName = "Notice"

export { Notice }
