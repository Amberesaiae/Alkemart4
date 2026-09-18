import * as React from "react"
import { Button } from "./button"
import { Input } from "./input"
import { cn } from "./cn"
import { merchRatioClass, type MerchCategoryRatio } from "./merchandising"
import { Label } from "./label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select"
import { Textarea } from "./textarea"

export type StudioTheme = "white" | "gold" | "black"

/**
 * Label + control + hint field wrappers shared by every settings surface
 * (admin studios, vendor settings). Each control is programmatically
 * labelled: Input/Textarea via htmlFor, Select via aria-labelledby.
 */

export function StudioTextField({ label, hint, ...props }: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  const id = React.useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-describedby={hintId} {...props} />
      {hint ? <p id={hintId} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function StudioTextareaField({ label, hint, ...props }: React.ComponentProps<typeof Textarea> & { label: string; hint?: string }) {
  const id = React.useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} aria-describedby={hintId} {...props} />
      {hint ? <p id={hintId} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function StudioSelect({ label, hint, children, groupLabel, ...props }: React.ComponentProps<typeof Select> & { label: string; hint?: string; groupLabel?: string }) {
  const labelId = React.useId()
  const hintId = hint ? `${labelId}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <Label id={labelId}>{label}</Label>
      <Select {...props}>
        <SelectTrigger aria-labelledby={labelId} aria-describedby={hintId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {groupLabel ? <SelectLabel>{groupLabel}</SelectLabel> : null}
            {children}
          </SelectGroup>
        </SelectContent>
      </Select>
      {hint ? <p id={hintId} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function ThemeField({ value, onChange }: { value: StudioTheme; onChange: (value: StudioTheme) => void }) {
  return (
    <StudioSelect label="Theme" groupLabel="Color theme" value={value} onValueChange={(next) => onChange(next as StudioTheme)}>
      <SelectItem value="white">White</SelectItem>
      <SelectItem value="gold">Gold</SelectItem>
      <SelectItem value="black">Black</SelectItem>
    </StudioSelect>
  )
}

/** Keyword shorthands an admin may type, as percentage pairs. */
const FOCAL_KEYWORDS: Record<string, [number, number]> = {
  center: [50, 50],
  top: [50, 0],
  bottom: [50, 100],
  left: [0, 50],
  right: [100, 50],
}

function parseFocalPoint(value: string | undefined): [number, number] {
  const raw = (value ?? "").trim().toLowerCase()
  if (!raw) return [50, 50]
  if (FOCAL_KEYWORDS[raw]) return FOCAL_KEYWORDS[raw]
  const parts = raw.split(/\s+/).map((part) => Number.parseFloat(part))
  if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
    return [clampPercent(parts[0]), clampPercent(parts[1])]
  }
  return [50, 50]
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

const RATIO_HINTS: Record<MerchCategoryRatio, string> = {
  square: "1:1",
  landscape: "4:3",
  wide: "3:2",
  ultrawide: "16:5",
}

/**
 * Image field with a ratio-accurate crop preview.
 *
 * A bare URL input hides the only thing that matters: what the art looks like
 * once cropped to its placement. This shows the real crop at the real ratio,
 * and — when `onFocalPointChange` is supplied — lets the admin move the focus
 * by clicking or with the arrow keys, so faces and products survive the crop.
 */
export function StudioImageField({ label, hint, value, onValueChange, ratio = "landscape", focalPoint, onFocalPointChange, placeholder, onUpload }: {
  label: string
  hint?: string
  value: string
  onValueChange: (value: string) => void
  ratio?: MerchCategoryRatio
  focalPoint?: string
  onFocalPointChange?: (value: string | undefined) => void
  placeholder?: string
  /** When set, a file picker stores the image on the media pipeline and fills the URL. */
  onUpload?: (file: File) => Promise<string>
}) {
  const id = React.useId()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const hintId = `${id}-hint`
  const [failed, setFailed] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const trimmed = value.trim()
  const invalid = trimmed !== "" && !trimmed.startsWith("/") && !trimmed.startsWith("https://")
  const [x, y] = parseFocalPoint(focalPoint)
  const adjustable = Boolean(onFocalPointChange)

  React.useEffect(() => { setFailed(false) }, [trimmed])

  const pickFile = async (file: File | undefined) => {
    if (!file || !onUpload) return
    setUploading(true)
    setUploadError(null)
    try {
      const url = await onUpload(file)
      onValueChange(url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  const setFocal = (nextX: number, nextY: number) => {
    const point = `${clampPercent(nextX)}% ${clampPercent(nextY)}%`
    onFocalPointChange?.(point === "50% 50%" ? undefined : point)
  }

  const onPreviewClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    setFocal(((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100)
  }

  const onPreviewKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 10 : 5
    if (event.key === "ArrowLeft") { event.preventDefault(); setFocal(x - step, y) }
    if (event.key === "ArrowRight") { event.preventDefault(); setFocal(x + step, y) }
    if (event.key === "ArrowUp") { event.preventDefault(); setFocal(x, y - step) }
    if (event.key === "ArrowDown") { event.preventDefault(); setFocal(x, y + step) }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id={id}
          value={value}
          inputMode="url"
          placeholder={placeholder ?? (onUpload ? "/media/… or https://…" : "https://…")}
          aria-describedby={hintId}
          aria-invalid={invalid || undefined}
          onChange={(event) => onValueChange(event.target.value)}
          className="min-w-0 flex-1"
        />
        {onUpload ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                void pickFile(file)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              aria-label={uploading ? "Uploading image" : `Upload ${label}`}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </>
        ) : null}
      </div>
      {uploadError ? <p role="alert" className="text-xs font-semibold text-destructive">{uploadError}</p> : null}

      {trimmed && !invalid ? (
        <div className="flex flex-col gap-1.5">
          <div className={cn("relative overflow-hidden rounded-xl border border-border bg-muted", merchRatioClass[ratio])}>
            {failed ? (
              <p className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs font-semibold text-muted-foreground">
                That image could not be loaded.
              </p>
            ) : (
              <img
                src={trimmed}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: `${x}% ${y}%` }}
                onError={() => setFailed(true)}
              />
            )}
            {adjustable && !failed ? (
              <button
                type="button"
                onClick={onPreviewClick}
                onKeyDown={onPreviewKeyDown}
                aria-label={`Crop focus, ${x}% across and ${y}% down. Click the image or use the arrow keys to move it.`}
                className="absolute inset-0 cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span
                  aria-hidden="true"
                  className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
                  style={{ left: `${x}%`, top: `${y}%` }}
                />
              </button>
            ) : null}
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              {RATIO_HINTS[ratio]}
            </span>
          </div>
          {adjustable ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Crop focus {x}% / {y}% — click the preview or use arrow keys.
              </p>
              {focalPoint ? (
                <button
                  type="button"
                  className="text-xs font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onFocalPointChange?.(undefined)}
                >
                  Center it
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <p id={hintId} className={cn("text-xs", invalid ? "font-semibold text-destructive" : "text-muted-foreground")}>
        {invalid ? "Images must use HTTPS or an internal path starting with /." : hint ?? (onUpload ? "Upload to media storage, or paste an HTTPS / internal path. Shown cropped to its real placement." : "HTTPS or an internal path. Shown cropped to its real placement.")}
      </p>
    </div>
  )
}

/**
 * A link as one field, not two.
 *
 * Label and href were separate inputs everywhere, so a section with a primary
 * and secondary action spent four of its controls on two links. Grouping them
 * halves the apparent form length and keeps the pair obviously related —
 * emptying both fields, or the Remove button, clears the link, which is what
 * "remove this button" means.
 */
export function StudioLinkField({ label, hint, value, onChange, optional = false }: {
  label: string
  hint?: string
  value: { label: string; href: string } | undefined
  onChange: (value: { label: string; href: string } | undefined) => void
  /** When true, emptying the button text removes the link entirely. */
  optional?: boolean
}) {
  const labelId = React.useId()
  const hrefId = `${labelId}-href`
  const hintId = `${labelId}-hint`
  const current = value ?? { label: "", href: "" }
  const hrefInvalid = current.href.trim() !== "" && !current.href.trim().startsWith("/")

  const emit = (next: { label: string; href: string }) => {
    if (optional && !next.label.trim() && !next.href.trim()) return onChange(undefined)
    onChange(next)
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <legend className="text-sm font-medium leading-none">{label}</legend>
        {optional && value ? (
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onChange(undefined)}>
            Remove
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5 sm:flex-row">
        <Input
          id={labelId}
          value={current.label}
          maxLength={40}
          placeholder="Button text"
          aria-label={`${label} text`}
          aria-describedby={hintId}
          className="sm:flex-1"
          onChange={(event) => emit({ ...current, label: event.target.value })}
        />
        <Input
          id={hrefId}
          value={current.href}
          placeholder="/categories/all"
          inputMode="url"
          aria-label={`${label} destination`}
          aria-describedby={hintId}
          aria-invalid={hrefInvalid || undefined}
          className="sm:flex-1"
          onChange={(event) => emit({ ...current, href: event.target.value })}
        />
      </div>
      <p id={hintId} className={cn("text-xs", hrefInvalid ? "font-semibold text-destructive" : "text-muted-foreground")}>
        {hrefInvalid
          ? "Links must be internal paths starting with /."
          : hint ?? (optional ? "Leave empty for no button." : "Text, then an internal path such as /categories/all.")}
      </p>
    </fieldset>
  )
}
