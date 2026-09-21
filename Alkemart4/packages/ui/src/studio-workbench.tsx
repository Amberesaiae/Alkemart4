import type { ReactNode } from "react"
import { DeviceMobile, Monitor } from "@phosphor-icons/react"
import { Button } from "./button"
import { cn } from "./cn"

export type StudioDevice = "mobile" | "desktop"

/**
 * Shared merchandising workbench: outline | canvas | inspector.
 *
 * Admin Homepage Studio and the vendor shop window use the same three-zone
 * shape so a merchandiser learns it once. Mobile is the default canvas —
 * that is where traffic is — with a desktop proof as an opt-in.
 */
export function StudioWorkbench({
  toolbar,
  outline,
  inspector,
  canvas,
  device = "mobile",
  onDevice,
  className,
}: {
  toolbar?: ReactNode
  outline: ReactNode
  inspector: ReactNode
  canvas: ReactNode
  device?: StudioDevice
  onDevice?: (device: StudioDevice) => void
  className?: string
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2 sm:px-4">
          {toolbar}
        </div>
      ) : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_340px]">
        <aside className="min-h-0 overflow-y-auto border-b border-border lg:border-b-0 lg:border-r" aria-label="Page outline">
          {outline}
        </aside>
        <section className="min-h-0 overflow-y-auto bg-tone-neutral-soft p-3 sm:p-5" aria-label="Canvas">
          {onDevice ? (
            <div className="mb-3 flex justify-center">
              <div className="inline-flex rounded-xl border border-border bg-white p-0.5 shadow-xs" role="group" aria-label="Canvas size">
                <Button
                  type="button"
                  size="sm"
                  variant={device === "mobile" ? "default" : "ghost"}
                  className="h-7 gap-1 px-2.5 text-xs"
                  aria-pressed={device === "mobile"}
                  onClick={() => onDevice("mobile")}
                >
                  <DeviceMobile className="h-3.5 w-3.5" aria-hidden />
                  Phone
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={device === "desktop" ? "default" : "ghost"}
                  className="h-7 gap-1 px-2.5 text-xs"
                  aria-pressed={device === "desktop"}
                  onClick={() => onDevice("desktop")}
                >
                  <Monitor className="h-3.5 w-3.5" aria-hidden />
                  Desktop
                </Button>
              </div>
            </div>
          ) : null}
          <div
            className={cn(
              "mx-auto overflow-hidden bg-white shadow-md",
              device === "mobile"
                ? "w-full max-w-[390px] rounded-[1.75rem] border-[8px] border-black"
                : "w-full max-w-5xl rounded-2xl border border-border",
            )}
          >
            {canvas}
          </div>
        </section>
        <aside className="min-h-0 overflow-y-auto border-t border-border lg:border-l lg:border-t-0" aria-label="Inspector">
          {inspector}
        </aside>
      </div>
    </div>
  )
}
