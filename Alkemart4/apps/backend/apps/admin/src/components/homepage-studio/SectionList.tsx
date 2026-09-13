import type { HomeSection } from "@alkemart/shared/homepage"
import { isSectionVisible } from "@alkemart/shared/homepage"
import { Copy, Eye, EyeSlash, Plus } from "@phosphor-icons/react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  EmptyState,
  Separator,
  cn,
} from "@workspace/ui"
import { newSection, sectionAccents, sectionLabels, sectionName } from "./model"

export function SectionList({ sections, selectedId, now, onSelect, onMove, onToggleVisible, onDuplicate, onAdd }: {
  sections: HomeSection[]
  selectedId: string | null
  now: Date
  onSelect: (id: string) => void
  onMove: (id: string, delta: -1 | 1) => void
  onToggleVisible: (id: string) => void
  onDuplicate: (id: string) => void
  onAdd: (section: HomeSection) => void
}) {
  return (
    <Card className="h-fit xl:sticky xl:top-4">
      <CardHeader>
        <h2 className="text-sm font-semibold leading-none tracking-tight">Sections</h2>
        <CardDescription>{sections.length} of 24 · Alt + ↑/↓ reorders a focused row</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <nav aria-label="Homepage sections">
          <ul className="flex flex-col gap-1.5">
            {sections.map((section, index) => {
              const live = isSectionVisible(section, now)
              const name = sectionName(section)
              const accent = sectionAccents[section.type]
              const AccentIcon = accent.icon
              const isSelected = selectedId === section.id
              return (
                <li key={section.id}>
                  <div className={cn(
                    "flex items-center gap-1 rounded-xl border p-1.5",
                    isSelected ? "border-primary bg-primary/10" : "border-border hover:border-foreground/25",
                  )}>
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", accent.chip)} aria-hidden="true">
                      <AccentIcon className="h-4 w-4" />
                    </span>
                    <button
                      id={`section-item-${section.id}`}
                      type="button"
                      aria-current={isSelected ? "true" : undefined}
                      onClick={() => onSelect(section.id)}
                      onKeyDown={(event) => {
                        if (event.altKey && event.key === "ArrowUp") { event.preventDefault(); onMove(section.id, -1) }
                        if (event.altKey && event.key === "ArrowDown") { event.preventDefault(); onMove(section.id, 1) }
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{name}</span>
                        <span className="block text-xs text-muted-foreground">{sectionLabels[section.type]}</span>
                        <span className="sr-only">, position {index + 1} of {sections.length}{live ? "" : ", hidden"}</span>
                      </span>
                    </button>
                    <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground" aria-hidden="true">{index + 1}</span>
                    {!live ? <Badge variant="outline" className="shrink-0">Off</Badge> : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={live ? `Hide ${name}` : `Show ${name}`}
                      aria-pressed={live}
                      title={live ? "Hide section" : "Show section"}
                      onClick={() => onToggleVisible(section.id)}
                    >
                      {live ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeSlash className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Duplicate ${name}`}
                      title="Duplicate section"
                      onClick={() => onDuplicate(section.id)}
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </nav>
        {!sections.length ? (
          <EmptyState
            title="No sections yet"
            description="Add a promo banner, category grid, or product shelf to start merchandising."
          />
        ) : null}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <Separator />
        <p id="add-section-label" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Add section</p>
        <div role="group" aria-labelledby="add-section-label" className="flex flex-col gap-1.5">
          {(Object.keys(sectionLabels) as HomeSection["type"][]).map((type) => {
            const accent = sectionAccents[type]
            const AccentIcon = accent.icon
            return (
              <Button
                key={type}
                variant="outline"
                size="sm"
                className="justify-start"
                disabled={sections.length >= 24}
                onClick={() => onAdd(newSection(type))}
              >
                <span className={cn("mr-2 flex size-6 items-center justify-center rounded-md", accent.chip)} aria-hidden="true">
                  <AccentIcon className="h-3.5 w-3.5" />
                </span>
                {sectionLabels[type]}
                <Plus className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </Button>
            )
          })}
        </div>
      </CardFooter>
    </Card>
  )
}
