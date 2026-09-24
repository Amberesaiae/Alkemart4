import { useEffect } from "react";

/**
 * Admin Live Studio edit affordances (read-only by design). Active only when
 * the page carries `?studio=1` — an explicit per-load opt-in. The iframe
 * never handles auth and never writes: clicks on tagged sections are merely
 * reported to the embedding admin app via postMessage, which owns the popup
 * editors and the admin-JWT writes. No secrets cross the frame boundary.
 */
export function isStudioEdit(): boolean {
  if (typeof window === "undefined") return false
  try {
    return new URLSearchParams(window.location.search).has("studio")
  } catch {
    return false
  }
}

export const STUDIO_SELECT_MESSAGE = "alkemart-studio:select"

export function reportStudioSection(sectionId: string): void {
  if (typeof window === "undefined" || !window.parent || window.parent === window) return
  window.parent.postMessage({ type: STUDIO_SELECT_MESSAGE, sectionId }, "*")
}

/** Toggles the gold hover outlines while edit mode is active. */
export function useStudioEditClass(): boolean {
  const active = isStudioEdit()
  useEffect(() => {
    if (!active || typeof document === "undefined") return
    document.body.classList.add("studio-edit")
    return () => document.body.classList.remove("studio-edit")
  }, [active])
  return active
}
