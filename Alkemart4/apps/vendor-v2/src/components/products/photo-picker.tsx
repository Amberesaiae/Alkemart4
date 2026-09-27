import { useRef, useState, type Dispatch, type SetStateAction } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, Camera01Icon, Cancel01Icon, StarIcon } from "@hugeicons/core-free-icons"
import { Progress } from "@workspace/console-ui/components/progress"
import { cn } from "@workspace/console-ui/lib/utils"
import { uploadImage } from "@/lib/products"

export const MAX_PHOTOS = 8

type Pending = { key: string; name: string; pct: number; error?: string; file: File }

/**
 * Photo grid: first photo is the cover. Uploads start the moment a photo is
 * picked (compressed on the device first) so "Next" is instant later.
 */
export function PhotoPicker({ value, onChange }: { value: string[]; onChange: Dispatch<SetStateAction<string[]>> }) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const room = MAX_PHOTOS - value.length - pending.filter((p) => !p.error).length

  async function upload(p: Pending) {
    try {
      const url = await uploadImage(p.file, (pct) => setPending((xs) => xs.map((x) => (x.key === p.key ? { ...x, pct } : x))))
      setPending((xs) => xs.filter((x) => x.key !== p.key))
      // Functional update: uploads finish out of order and must not clobber each other.
      onChange((prev) => [...prev, url])
    } catch (err) {
      setPending((xs) => xs.map((x) => (x.key === p.key ? { ...x, error: (err as Error).message } : x)))
    }
  }

  function pick(files: FileList | null) {
    if (!files) return
    const take = [...files].slice(0, Math.max(0, room))
    const next = take.map((file) => ({ key: crypto.randomUUID(), name: file.name, pct: 0, file }))
    setPending((xs) => [...xs, ...next])
    next.forEach((p) => void upload(p))
    if (input.current) input.current.value = ""
  }

  const move = (i: number, to: number) => {
    const next = [...value]
    const [x] = next.splice(i, 1)
    next.splice(to, 0, x!)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4" aria-label="Product photos">
        {value.map((url, i) => (
          <li key={url} className="group relative aspect-square overflow-hidden rounded-2xl bg-surface">
            <img src={url} alt={`Photo ${i + 1}${i === 0 ? " (cover)" : ""}`} className="size-full object-cover" />
            {i === 0 ? (
              <span className="absolute top-1.5 left-1.5 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-brand-foreground">Cover</span>
            ) : null}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
              {i > 0 ? (
                <button
                  type="button"
                  onClick={() => move(i, 0)}
                  className="grid size-9 place-items-center rounded-full bg-background/90 shadow-sm"
                  aria-label={`Make photo ${i + 1} the cover`}
                >
                  <HugeiconsIcon icon={StarIcon} className="size-4" />
                </button>
              ) : (
                <span />
              )}
              {i > 1 ? (
                <button type="button" onClick={() => move(i, i - 1)} className="grid size-9 place-items-center rounded-full bg-background/90 shadow-sm" aria-label={`Move photo ${i + 1} earlier`}>
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onChange((prev) => prev.filter((u) => u !== url))}
                className="grid size-9 place-items-center rounded-full bg-background/90 shadow-sm"
                aria-label={`Remove photo ${i + 1}`}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
              </button>
            </div>
          </li>
        ))}
        {pending.map((p) => (
          <li key={p.key} className="relative grid aspect-square place-items-center rounded-2xl border border-dashed p-3 text-center text-xs">
            {p.error ? (
              <div className="space-y-2">
                <p className="font-semibold text-destructive">{p.error}</p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => {
                      setPending((xs) => xs.map((x) => (x.key === p.key ? { ...x, error: undefined, pct: 0 } : x)))
                      void upload({ ...p, error: undefined })
                    }}
                  >
                    Retry
                  </button>
                  <button type="button" className="underline" onClick={() => setPending((xs) => xs.filter((x) => x.key !== p.key))}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-2" aria-live="polite">
                <p className="text-muted-foreground">Uploading… {p.pct}%</p>
                <Progress value={p.pct} aria-label={`Uploading ${p.name}`} />
              </div>
            )}
          </li>
        ))}
        {room > 0 ? (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className={cn(
                "flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed text-sm font-semibold transition-colors hover:border-foreground/40 hover:bg-muted",
                value.length === 0 && "border-brand-strong bg-brand/10",
              )}
            >
              <HugeiconsIcon icon={Camera01Icon} className="size-7" aria-hidden />
              {value.length === 0 ? "Add photos" : "Add more"}
            </button>
          </li>
        ) : null}
      </ul>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => pick(e.target.files)} tabIndex={-1} aria-hidden />
      <p className="text-sm text-muted-foreground">
        Up to {MAX_PHOTOS} photos. Tip: daylight, plain background, and the first photo showing the whole item.
      </p>
    </div>
  )
}
