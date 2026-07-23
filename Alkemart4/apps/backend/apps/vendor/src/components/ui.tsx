/**
 * Shared presentational primitives for alkemart panel extensions.
 * WCAG: 44px targets, visible labels, focus rings, no inline styles.
 */
import { Component, type ReactNode } from "react"

export function AlkBadge({ children }: { children: ReactNode }) {
  return <span className="alk-badge">{children}</span>
}

export function AlkPage({ children }: { children: ReactNode }) {
  return <div className="alk-page">{children}</div>
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
        {badge ? <div className="alk-badge alk-badge-spaced">{badge}</div> : null}
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
    <section className={wide ? "alk-chart-card alk-chart-card-wide" : "alk-chart-card"}>
      <h2>{title}</h2>
      {subtitle ? <p className="alk-chart-sub">{subtitle}</p> : null}
      <div className="alk-chart-body">{children}</div>
    </section>
  )
}

export type AlkBannerTone = "default" | "success" | "warning" | "danger" | "info"

export function AlkBanner({
  title,
  body,
  action,
  tone = "default",
  as = "div",
  onClick,
}: {
  title: string
  body: string
  action?: ReactNode
  tone?: AlkBannerTone
  as?: "div" | "section"
  onClick?: () => void
}) {
  const Tag = as
  return (
    <Tag
      className={`alk-banner alk-banner-${tone}`}
      role={onClick ? "button" : tone === "danger" ? "alert" : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className="alk-banner-text">
        <strong className="alk-banner-title">{title}</strong>
        <p className="alk-banner-body">{body}</p>
      </div>
      {action ? <div className="alk-banner-actions">{action}</div> : null}
    </Tag>
  )
}

export function AlkPanel({
  title,
  children,
  footer,
  id,
}: {
  title?: string
  children: ReactNode
  footer?: ReactNode
  id?: string
}) {
  const titleId = id ? `${id}-title` : undefined
  return (
    <section
      className="alk-panel"
      id={id}
      aria-labelledby={title && titleId ? titleId : undefined}
    >
      {title ? (
        <h3 className="alk-section-title" id={titleId}>
          {title}
        </h3>
      ) : null}
      <div className="alk-stack">{children}</div>
      {footer ? <div className="alk-panel-footer">{footer}</div> : null}
    </section>
  )
}

export function AlkField({
  label,
  children,
  hint,
  htmlFor,
}: {
  label: string
  children: ReactNode
  hint?: string
  htmlFor?: string
}) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined
  return (
    <div className="alk-field">
      <label className="alk-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? (
        <span className="alk-field-hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  )
}

export function AlkButton({
  children,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
  "aria-busy": ariaBusy,
}: {
  children: ReactNode
  variant?: "primary" | "secondary" | "danger"
  type?: "button" | "submit"
  disabled?: boolean
  onClick?: () => void
  "aria-busy"?: boolean
}) {
  const cls =
    variant === "secondary"
      ? "alk-btn alk-btn-secondary"
      : variant === "danger"
        ? "alk-btn alk-btn-danger"
        : "alk-btn"
  return (
    <button
      type={type}
      className={cls}
      disabled={disabled}
      onClick={onClick}
      aria-busy={ariaBusy || undefined}
    >
      {children}
    </button>
  )
}

export function AlkEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="alk-empty" role="status">
      {children}
    </div>
  )
}

export function AlkError({ children }: { children: ReactNode }) {
  return (
    <div className="alk-error" role="alert">
      {children}
    </div>
  )
}

export class AlkErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <AlkError>
            Something went wrong loading this section.{" "}
            <button
              className="alk-link alk-retry-btn"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </AlkError>
        )
      )
    }
    return this.props.children
  }
}

export function AlkLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <a className="alk-link" href={href}>
      {children}
    </a>
  )
}
