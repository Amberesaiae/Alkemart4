import { useMemo, useState } from "react"
import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DEPARTMENT_ICON } from "@/components/commerce/category-tile"
import { useCategories } from "@/hooks/use-store"
import { departmentFor } from "@/lib/departments"
import { cn } from "@/lib/utils"

/**
 * Desktop departments menu: department list on the left, the hovered
 * department's children on the right. Names and tree come from the API.
 */
export function CategoryMenu() {
  const { data = [] } = useCategories()
  const [open, setOpen] = useState(false)
  const tops = useMemo(() => data.filter((c) => !c.parentCategoryId), [data])
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = tops.find((c) => c.id === activeId) ?? tops[0]
  const children = useMemo(
    () => (active ? data.filter((c) => c.parentCategoryId === active.id) : []),
    [data, active],
  )
  const close = () => setOpen(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold hover:bg-foreground/5 aria-expanded:bg-foreground/5 lg:group-data-[tone=hero]/header:text-white lg:group-data-[tone=hero]/header:hover:bg-white/10 lg:group-data-[tone=hero]/header:aria-expanded:bg-white/10"
        >
          Categories
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={10} className="w-[min(760px,90vw)] rounded-3xl p-0">
        {tops.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Departments are loading…</p>
        ) : (
          <div className="grid grid-cols-[260px_1fr]">
            <ul className="max-h-[70vh] overflow-y-auto border-r border-border p-2">
              {tops.map((c) => {
                const dept = departmentFor(c.handle, c.name)
                const isActive = c.id === active?.id
                return (
                  <li key={c.id}>
                    <Link
                      to="/categories/$slug"
                      params={{ slug: c.handle ?? c.id }}
                      onClick={close}
                      onMouseEnter={() => setActiveId(c.id)}
                      onFocus={() => setActiveId(c.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium",
                        isActive ? "bg-muted" : "hover:bg-muted",
                      )}
                    >
                      <span
                        className="grid size-8 place-items-center rounded-full"
                        style={{ background: dept.ground }}
                      >
                        <HugeiconsIcon
                          icon={DEPARTMENT_ICON[dept.id]}
                          className={cn("size-4", dept.tone === "light" ? "text-white" : "text-foreground")}
                        />
                      </span>
                      <span className="flex-1 truncate">{c.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="p-5">
              {active ? (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-lg font-extrabold">{active.name}</p>
                    <Link
                      to="/categories/$slug"
                      params={{ slug: active.handle ?? active.id }}
                      onClick={close}
                      className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                    >
                      Shop all <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                    </Link>
                  </div>
                  {children.length > 0 ? (
                    <ul className="grid grid-cols-2 gap-1">
                      {children.map((c) => (
                        <li key={c.id}>
                          <Link
                            to="/categories/$slug"
                            params={{ slug: c.handle ?? c.id }}
                            onClick={close}
                            className="block rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            {c.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Everything in {active.name} is in one place.</p>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}
        <div className="border-t border-border p-3">
          <Link
            to="/categories"
            onClick={close}
            className="flex items-center justify-center gap-1 rounded-2xl py-2 text-sm font-semibold hover:bg-muted"
          >
            See all categories <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
