import { Link } from "@tanstack/react-router"
import { Checkbox, Label } from "@workspace/ui"
import { deptAccentClass } from "@/lib/catalog-nav"
import { cn } from "@/lib/utils"

export type ListingCategoryOpt = { id: string; name: string; handle?: string | null }
export type ListingSellerOpt = { handle: string; name: string }

type Props = {
  department: string
  departmentName: string
  categories: ListingCategoryOpt[]
  sellers: ListingSellerOpt[]
  selectedSellers: string[]
  onToggleSeller: (handle: string) => void
  className?: string
}

export function ListingSidePanels({
  department,
  departmentName,
  categories,
  sellers,
  selectedSellers,
  onToggleSeller,
  className,
}: Props) {
  return (
    <aside className={cn("space-y-4", className)} aria-label="Filters">
      {categories.length > 0 ? (
        <div
          data-testid="panel-categories"
          className={cn("rounded-xl p-4 shadow-xs", deptAccentClass(departmentName, department))}
        >
          <p className="mb-2 text-sm font-bold uppercase tracking-wide">Categories</p>
          <ul className="space-y-1 text-sm">
            <li>
              <Link to="/categories/$slug" params={{ slug: "all" }} className="block min-h-10 py-1.5 font-medium">
                All products
              </Link>
            </li>
            {categories.map((c) => {
              const slug = (c.handle || c.id).toLowerCase()
              const on = department === slug
              return (
                <li key={c.id}>
                  <Link
                    to="/categories/$slug"
                    params={{ slug }}
                    className={cn("block min-h-10 truncate py-1.5", on && "font-bold underline")}
                  >
                    {c.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {sellers.length > 0 ? (
        <div data-testid="panel-brands" className="panel-brands rounded-xl p-4 shadow-xs">
          <p className="mb-2 text-sm font-bold uppercase tracking-wide">Brands / Sellers</p>
          <ul className="space-y-1 text-sm">
            {sellers.map((s) => {
              const checked = selectedSellers.includes(s.handle)
              const id = `seller-${s.handle}`
              return (
                <li key={s.handle} className="flex min-h-10 items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => onToggleSeller(s.handle)}
                  />
                  <Label htmlFor={id} className="cursor-pointer font-normal text-white">
                    {s.name}
                  </Label>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </aside>
  )
}
