import type { HomeSection, HomeSectionType } from "@alkemart/shared/homepage"
import { ArrowLeft } from "@phosphor-icons/react"
import { useState } from "react"
import { Button, Modal, cn } from "@workspace/ui"
import { sectionAccents, sectionHints, sectionLabels, sectionPresets } from "./model"

const LIBRARY_GROUPS: { title: string; hint: string; types: HomeSectionType[] }[] = [
  {
    title: "Campaigns",
    hint: "Seasonal strips that sit after the plot.",
    types: ["promo_hero", "promo_band", "countdown_banner", "marquee", "promo_grid"],
  },
  {
    title: "Extra shelves",
    hint: "Only if the plot is not enough. Rules beat picks.",
    types: ["product_shelf", "deal_rail", "store_rail", "category_grid", "value_grid"],
  },
]

/**
 * Section library dialog: every registered type, then presets for types that offer a
 * choice. Single-preset types add immediately. Used for gap inserts and
 * the end-of-page add, so a section can land at a position, not just
 * appended at the bottom.
 */
export function SectionLibrary({ open, disabled, title, onClose, onPick }: {
  open: boolean
  disabled: boolean
  title: string
  onClose: () => void
  onPick: (section: HomeSection) => void
}) {
  const [pendingType, setPendingType] = useState<HomeSection["type"] | null>(null)
  const close = () => {
    onClose()
    setPendingType(null)
  }
  const pick = (section: HomeSection) => {
    onPick(section)
    setPendingType(null)
  }

  return (
    <Modal
      isOpen={open}
      onClose={close}
      title={pendingType ? sectionLabels[pendingType] : title}
      className="max-w-xl"
    >
      {pendingType ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{sectionHints[pendingType]} Pick a starting point — everything stays editable.</p>
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setPendingType(null)}>
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
            All types
          </Button>
          {sectionPresets[pendingType].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => pick(preset.build())}
              className="rounded-lg border border-border p-3.5 text-left hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block text-sm font-semibold">{preset.label}</span>
              <span className="block text-xs text-muted-foreground">{preset.description}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {LIBRARY_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{group.title}</p>
                <p className="text-xs text-muted-foreground">{group.hint}</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.types.map((type) => {
                  const accent = sectionAccents[type]
                  const AccentIcon = accent.icon
                  const presets = sectionPresets[type]
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (presets.length === 1) pick(presets[0].build())
                        else setPendingType(type)
                      }}
                      className="flex items-start gap-2.5 rounded-lg border border-border p-3.5 text-left hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", accent.chip)} aria-hidden="true">
                        <AccentIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {sectionLabels[type]}
                          {presets.length > 1 ? <span className="ml-1.5 font-normal text-muted-foreground">· {presets.length} presets</span> : null}
                        </span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">{sectionHints[type]}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
