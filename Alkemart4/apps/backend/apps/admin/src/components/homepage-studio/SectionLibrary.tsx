import type { HomeSection } from "@alkemart/shared/homepage"
import { ArrowLeft } from "@phosphor-icons/react"
import { useState } from "react"
import { Button, Modal, cn } from "@workspace/ui"
import { SECTION_TYPES, sectionAccents, sectionHints, sectionLabels, sectionPresets } from "./model"

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
              className="rounded-2xl border border-border p-3.5 text-left transition-shadow hover:border-foreground/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block text-sm font-semibold">{preset.label}</span>
              <span className="block text-xs text-muted-foreground">{preset.description}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SECTION_TYPES.map((type) => {
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
                className="flex items-start gap-2.5 rounded-2xl border border-border p-3.5 text-left transition-shadow hover:border-foreground/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", accent.chip)} aria-hidden="true">
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
      )}
    </Modal>
  )
}
