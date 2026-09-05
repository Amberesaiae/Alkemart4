import { useEffect, useId, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"
import type { IconId } from "@/design/icons"
import { IconSafe } from "@/design/icons"
import { iconForCategory, type RailCategory, type RailChild } from "@/lib/catalog-nav"
import { cn } from "@/lib/utils"

type Props = {
  categories: RailCategory[]
  activeSlug?: string
  className?: string
}

/**
 * Short department rail. Each chip links to the department and opens a
 * lightweight popdown of subcategories when children exist.
 */
export function CategoryIconRail({
  categories,
  activeSlug,
  className,
}: Props) {
  if (!categories.length) return null

  return (
    <nav
      aria-label="Departments"
      className={cn("border-b border-border bg-card", className)}
    >
      <div className="relative mx-auto w-full max-w-[1200px]">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-card to-transparent sm:hidden"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-card to-transparent sm:hidden"
          aria-hidden
        />
        <div
          className={cn(
            "scrollbar-none flex w-full items-center",
            "justify-start gap-1 overflow-x-auto px-4 py-2.5",
            "sm:justify-center sm:flex-wrap sm:gap-1.5 sm:overflow-visible sm:px-6 sm:py-3",
          )}
        >
          {categories.map((c) => (
            <RailItem
              key={c.id}
              slug={(c.handle || c.id).toLowerCase()}
              label={c.name}
              iconId={c.icon ?? iconForCategory(c.name, c.handle)}
              children={c.children ?? []}
              active={
                activeSlug === (c.handle || c.id).toLowerCase() ||
                (c.children ?? []).some((ch) => ch.handle === activeSlug)
              }
            />
          ))}
        </div>
      </div>
    </nav>
  )
}

function RailItem(props: {
  slug: string
  label: string
  iconId: IconId
  children: RailChild[]
  active: boolean
}) {
  const hasKids = props.children.length > 0
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const chipClass = cn(
    "group relative flex shrink-0 flex-row items-center gap-1.5",
    "rounded-full px-2.5 py-1.5 transition sm:gap-2 sm:px-3 sm:py-2",
    "hover:bg-muted/60",
    props.active || open
      ? "bg-muted/80 text-foreground"
      : "text-muted-foreground hover:text-foreground",
  )

  if (!hasKids) {
    return (
      <Link
        to="/categories/$slug"
        params={{ slug: props.slug }}
        className={chipClass}
      >
        <IconSafe name={props.iconId} size={20} preferAsset className="shrink-0" />
        <span
          className={cn(
            "max-w-[9.5rem] truncate whitespace-nowrap text-sm font-medium leading-none sm:max-w-none",
            props.active && "font-semibold",
          )}
        >
          {props.label}
        </span>
        <ActiveBar active={props.active} />
      </Link>
    )
  }

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-center">
        <Link
          to="/categories/$slug"
          params={{ slug: props.slug }}
          className={cn(chipClass, "rounded-r-none pr-1.5 sm:pr-2")}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
        >
          <IconSafe name={props.iconId} size={20} preferAsset className="shrink-0" />
          <span
            className={cn(
              "max-w-[9.5rem] truncate whitespace-nowrap text-sm font-medium leading-none sm:max-w-none",
              (props.active || open) && "font-semibold",
            )}
          >
            {props.label}
          </span>
          <ActiveBar active={props.active || open} />
        </Link>
        <button
          type="button"
          className={cn(
            chipClass,
            "rounded-l-none border-l border-border/60 px-2",
            open && "bg-muted/80 text-foreground",
          )}
          aria-label={`${props.label} subcategories`}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          <Chevron open={open} />
        </button>
      </div>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={`${props.label} subcategories`}
          className={cn(
            "absolute left-0 top-full z-40 mt-1 min-w-[12rem] overflow-hidden",
            "rounded-xl border border-border bg-card py-1 shadow-lg",
          )}
        >
          <Link
            role="menuitem"
            to="/categories/$slug"
            params={{ slug: props.slug }}
            className="block px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/70"
            onClick={() => setOpen(false)}
          >
            Shop all {props.label}
          </Link>
          <div className="my-1 border-t border-border" />
          {props.children.map((ch) => (
            <Link
              key={ch.id}
              role="menuitem"
              to="/categories/$slug"
              params={{ slug: ch.handle }}
              className="block px-3 py-2 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              {ch.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ActiveBar({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full transition sm:inset-x-3",
        active ? "bg-primary" : "bg-transparent",
      )}
      aria-hidden
    />
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={cn("size-3 shrink-0 transition", open && "rotate-180")}
      aria-hidden
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
