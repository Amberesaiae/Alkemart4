/**
 * Shared presentational primitives for alkemart panel extensions.
 * Keep markup + classNames consistent across Admin widgets and pages.
 */
import type { CSSProperties, ReactNode } from "react"

export function AlkBadge({ children }: { children: ReactNode }) {
  return <span className="alk-badge">{children}</span>
}

export function AlkPage({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div className="alk-page" style={style}>
      {children}
    </div>
  )
}

export function AlkPageHeader({
  badge,
  title,
  description,
  meta,
}: {
  badge?: string
  title: string
  description?: string
  meta?: ReactNode
}) {
  return (
    <header className="alk-page-header">
      <div>
        {badge ? (
          <div className="alk-badge" style={{ marginBottom: 8 }}>
            {badge}
          </div>
        ) : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {meta ? <div className="alk-page-meta">{meta}</div> : null}
    </header>
  )
}

export function AlkKpiGrid({ children }: { children: ReactNode }) {
  return <div className="alk-kpi-grid">{children}</div>
}

export function AlkKpi({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <div className="alk-kpi">
      <div className="alk-kpi-label">{label}</div>
      <div className="alk-kpi-value">{value}</div>
      {hint ? <div className="alk-kpi-hint">{hint}</div> : null}
    </div>
  )
}

export function AlkChartCard({
  title,
  subtitle,
  children,
  wide,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <section
      className="alk-chart-card"
      style={wide ? { gridColumn: "1 / -1" } : undefined}
    >
      <h2>{title}</h2>
      {subtitle ? <p className="alk-chart-sub">{subtitle}</p> : null}
      <div className="alk-chart-body">{children}</div>
    </section>
  )
}

export function AlkBanner({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="alk-banner">
      <strong>{title}</strong>
      <span className="alk-banner-body">{body}</span>
      {action}
    </div>
  )
}

export function AlkEmpty({ children }: { children: ReactNode }) {
  return <div className="alk-empty">{children}</div>
}

export function AlkError({ children }: { children: ReactNode }) {
  return <div className="alk-error">{children}</div>
}
