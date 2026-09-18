import { X } from "@phosphor-icons/react"
import { useEffect } from "react"
import { Button } from "@workspace/ui"

/**
 * Right slide-over dialog for section editing. The canvas stays visible
 * beside it, so edits keep their visual context — unlike a centred modal,
 * which covers the block being edited. Closes on X, overlay click or
 * Escape; focus returns to the layer's Edit button.
 */
export function SlideOver({ open, label, returnFocusId, onClose, children }: {
  open: boolean
  label: string
  /** Element id to focus on close (the layer's Edit button). */
  returnFocusId: string | null
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open || !returnFocusId) return
    document.getElementById(returnFocusId)?.focus()
  }, [open, returnFocusId])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 overscroll-contain">
      <button
        type="button"
        aria-label="Close section settings"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute bottom-0 right-0 top-0 flex w-full max-w-[400px] flex-col border-l border-border bg-white shadow-xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {children}
        </div>
        <div className="flex gap-2 border-t border-border p-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SlideOverClose({ onClose }: { onClose: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Close section settings"
      onClick={onClose}
      className="absolute right-3 top-3 z-10 h-8 w-8 bg-white/80 backdrop-blur"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </Button>
  )
}
