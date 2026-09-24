import type { MouseEvent, ReactNode } from "react"
import { isStudioEdit, reportStudioSection } from "@/lib/studio-edit"

/**
 * Click-to-edit wrapper for Admin Live Studio. Inert in normal browsing:
 * no outlines, no handlers, zero layout effect. Under `?studio=1` each
 * section reports its stable id to the parent frame on click (capture phase
 * so inner links don't navigate away from the editing session).
 */
export function StudioSection({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  if (!isStudioEdit()) return <>{children}</>
  const onClickCapture = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    reportStudioSection(id)
  }
  return (
    <div data-studio-section={id} aria-label={`Edit ${label}`} onClickCapture={onClickCapture}>
      {children}
    </div>
  )
}
