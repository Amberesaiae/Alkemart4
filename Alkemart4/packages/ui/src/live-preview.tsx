import * as React from "react"
import { ArrowSquareOut, DeviceMobile, DeviceTablet, X } from "@phosphor-icons/react"
import { cn } from "./cn"
import { Button } from "./button"

export type LivePreviewMode = "desktop" | "mobile"

export interface LivePreviewProps {
  /** Accessible title for the iframe, e.g. "Live preview of your shop". */
  title: string
  /** Absolute page URL to render. Null renders `emptyHint`. */
  pageUrl: string | null
  /** Shown when `pageUrl` is null. */
  emptyHint?: string
  /** Caption under the frame, e.g. "Preview renders your real page — publish to update it." */
  note?: string
  defaultMode?: LivePreviewMode
  /** Optional dismiss action rendered as a close button in the toolbar. */
  onClose?: () => void
  closeLabel?: string
  /** Hide the toolbar when the host already provides perspective/width controls. */
  hideToolbar?: boolean
  className?: string
}

/**
 * Real page preview shared by every studio surface (vendor store page,
 * admin homepage studio). Renders the actual storefront in an iframe —
 * never placeholder blocks — with a desktop/mobile width toggle.
 */
export function LivePreview({
  title,
  pageUrl,
  emptyHint,
  note,
  defaultMode = "desktop",
  onClose,
  closeLabel = "Close preview",
  hideToolbar = false,
  className,
}: LivePreviewProps) {
  const [mode, setMode] = React.useState<LivePreviewMode>(defaultMode)
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {!hideToolbar ? (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-2">
        <div className="inline-flex rounded-lg border border-border bg-background p-0.5 shadow-2xs" role="group" aria-label="Preview width">
          <Button
            type="button"
            size="sm"
            variant={mode === "desktop" ? "default" : "ghost"}
            aria-pressed={mode === "desktop"}
            onClick={() => setMode("desktop")}
            className="h-7 gap-1 px-2.5 text-xs"
          >
            <DeviceTablet className="h-3.5 w-3.5" aria-hidden="true" />
            Desktop
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "mobile" ? "default" : "ghost"}
            aria-pressed={mode === "mobile"}
            onClick={() => setMode("mobile")}
            className="h-7 gap-1 px-2.5 text-xs"
          >
            <DeviceMobile className="h-3.5 w-3.5" aria-hidden="true" />
            Mobile
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {pageUrl ? (
            <a
              href={pageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-foreground transition hover:bg-muted"
            >
              Open <ArrowSquareOut className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : null}
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={closeLabel}
              title={closeLabel}
              onClick={onClose}
              className="size-7"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
      ) : null}
      <div
        className="mx-auto w-full overflow-hidden rounded-2xl border-2 border-border bg-card shadow-md transition-[max-width] motion-reduce:transition-none"
        style={{ maxWidth: mode === "mobile" ? 390 : "100%" }}
      >
        {pageUrl ? (
          <iframe
            key={pageUrl}
            title={title}
            src={pageUrl}
            loading="lazy"
            className="h-[580px] w-full bg-background"
          />
        ) : (
          <p className="p-8 text-center text-sm font-medium text-muted-foreground">
            {emptyHint ?? "Nothing to preview yet."}
          </p>
        )}
      </div>
      {note ? <p className="text-center text-xs font-medium text-muted-foreground">{note}</p> : null}
    </div>
  )
}
