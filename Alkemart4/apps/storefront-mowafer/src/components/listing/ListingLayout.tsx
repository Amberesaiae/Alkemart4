import { Breadcrumbs, Button, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui"
import { Faders } from "@phosphor-icons/react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type Props = {
  departmentLabel: string
  hero?: ReactNode
  filterStrip?: ReactNode
  sidebar: ReactNode
  children: ReactNode
  className?: string
}

export function ListingLayout({
  departmentLabel,
  hero,
  filterStrip,
  sidebar,
  children,
  className,
}: Props) {
  return (
    <div className={cn("space-y-5", className)}>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: departmentLabel },
        ]}
      />
      {hero}
      {filterStrip}

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="rounded-full">
              <Faders size={16} />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{sidebar}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="hidden min-w-0 lg:block">{sidebar}</div>
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </div>
  )
}
