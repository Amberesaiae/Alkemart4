import type { HomeSection } from "@alkemart/shared/homepage"
import { DEFAULT_HOMEPAGE_SECTIONS } from "@alkemart/shared/homepage"
import { CaretDown, CaretUp, Plus } from "@phosphor-icons/react"
import { Button, cn } from "@workspace/ui"
import { sectionAccents, sectionLabels, sectionName, type SectionIssue } from "./model"

const COURSE_IDS = new Set(DEFAULT_HOMEPAGE_SECTIONS.map((section) => section.id))

export function StudioOutline({
  sections,
  selectedId,
  issues,
  onSelect,
  onMove,
  onAdd,
}: {
  sections: HomeSection[]
  selectedId: string | null
  issues: SectionIssue[]
  onSelect: (section: HomeSection) => void
  onMove: (id: string, delta: -1 | 1) => void
  onAdd: () => void
}) {
  const course = sections.filter((section) => COURSE_IDS.has(section.id))
  const rest = sections.filter((section) => !COURSE_IDS.has(section.id))

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Plot</p>
      <ol className="flex flex-col gap-1">
        {course.map((section, index) => (
          <OutlineRow
            key={section.id}
            section={section}
            selected={section.id === selectedId}
            issues={issues.filter((issue) => issue.sectionId === section.id).length}
            index={sections.indexOf(section)}
            total={sections.length}
            locked
            onSelect={() => onSelect(section)}
            onMove={(delta) => onMove(section.id, delta)}
            label={`${index + 1}. ${sectionName(section)}`}
          />
        ))}
      </ol>
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Campaigns</p>
        <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add
        </Button>
      </div>
      {rest.length ? (
        <ol className="flex flex-col gap-1">
          {rest.map((section) => (
            <OutlineRow
              key={section.id}
              section={section}
              selected={section.id === selectedId}
              issues={issues.filter((issue) => issue.sectionId === section.id).length}
              index={sections.indexOf(section)}
              total={sections.length}
              onSelect={() => onSelect(section)}
              onMove={(delta) => onMove(section.id, delta)}
              label={sectionName(section)}
            />
          ))}
        </ol>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">Seasonal strips sit after the plot. They never steal the first screen.</p>
      )}
    </div>
  )
}

function OutlineRow({
  section,
  selected,
  issues,
  index,
  total,
  locked,
  label,
  onSelect,
  onMove,
}: {
  section: HomeSection
  selected: boolean
  issues: number
  index: number
  total: number
  locked?: boolean
  label: string
  onSelect: () => void
  onMove: (delta: -1 | 1) => void
}) {
  const Accent = sectionAccents[section.type].icon
  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-1 rounded-lg border px-1.5 py-1",
          selected ? "border-primary bg-white shadow-xs" : "border-transparent hover:bg-muted/60",
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left"
        >
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-lg", sectionAccents[section.type].chip)} aria-hidden>
            <Accent className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold">{label}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {sectionLabels[section.type]}
              {locked ? " · plot" : ""}
              {section.visible === false ? " · hidden" : ""}
              {issues ? ` · ${issues} to fix` : ""}
            </span>
          </span>
        </button>
        {!locked ? (
          <span className="flex shrink-0">
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={index === 0} aria-label="Move earlier" onClick={() => onMove(-1)}>
              <CaretUp className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={index === total - 1} aria-label="Move later" onClick={() => onMove(1)}>
              <CaretDown className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </span>
        ) : null}
      </div>
    </li>
  )
}
