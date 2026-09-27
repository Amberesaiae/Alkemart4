import { useContext, useRef, useState, type ReactNode } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FlowContext, PROVIDER_LABEL, errText, useSave } from "./shared"
import { toast } from "sonner"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  Copy01Icon,
  Facebook02Icon,
  ImageUpload01Icon,
  InstagramIcon,
  MinusSignIcon,
  Add01Icon,
  PauseIcon,
  PlayIcon,
  SmartPhone01Icon,
  TiktokIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons"
import { DISPATCH_HOUR_OPTIONS, MAX_PROMISE_DAYS, normalizeSocial, socialHandle, type SocialKind } from "@alkemart/domain"
import { GHANA_COUNTRY_CODE, GHANA_REGIONS, detectMobileOperator } from "@alkemart/shared/ghana"
import { LocationPicker, type Pin, type Place } from "@alkemart/maps"
import { Button } from "@workspace/console-ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/console-ui/components/card"
import { Input } from "@workspace/console-ui/components/input"
import { Label } from "@workspace/console-ui/components/label"
import { Skeleton } from "@workspace/console-ui/components/skeleton"
import { Spinner } from "@workspace/console-ui/components/spinner"
import { Switch } from "@workspace/console-ui/components/switch"
import { Textarea } from "@workspace/console-ui/components/textarea"
import { ToggleGroup, ToggleGroupItem } from "@workspace/console-ui/components/toggle-group"
import { DatePicker, TimeSelect } from "@workspace/console-ui/components/console/date-time-picker"
import { currencySymbol, minorToMajorText, parseMajorToMinor } from "@workspace/console-ui/lib/money"
import { cn } from "@workspace/console-ui/lib/utils"
import { getApiUrl } from "@/lib/env"
import { uploadImage } from "@/lib/products"
import { qk } from "@/lib/queries"
import {
  pauseShop,
  saveContact,
  saveDelivery,
  saveFulfillment,
  savePayoutAccount,
  savePolicy,
  saveDispatchAddress,
  saveProfile,
  saveStorefront,
  unpauseShop,
  type DeliveryZoneKey,
  type MomoProvider,
  type PolicyBody,
  type ShopSettings,
} from "@/lib/shop"

/**
 * Inside the setup stepper a section renders without its card (the step has
 * the heading) and its save button becomes "Save and continue".
 */
export function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  const flow = useContext(FlowContext)
  if (flow) {
    return (
      <div id={id} className="space-y-5">
        {children}
      </div>
    )
  }
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

/** `onClick` returns the save's promise; a rejected promise keeps the stepper on this step. */
export function SaveButton({
  show,
  pending,
  onClick,
  children = "Save",
}: {
  show: boolean
  pending: boolean
  onClick: () => Promise<unknown> | void
  children?: ReactNode
}) {
  const flow = useContext(FlowContext)
  if (flow) {
    return (
      <div className="border-t pt-5">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={async () => {
            if (show) {
              try {
                await onClick()
              } catch {
                return
              }
            }
            flow.next()
          }}
        >
          {pending ? <Spinner /> : null} {show ? "Save and continue" : "Continue"}
        </Button>
      </div>
    )
  }
  if (!show) return null
  return (
    <Button size="lg" onClick={() => void onClick()} disabled={pending}>
      {pending ? <Spinner /> : null} {children}
    </Button>
  )
}

// ─── Open / break ───────────────────────────────────────────────────────

export function OpenCard({ s }: { s: ShopSettings }) {
  const paused = s.availability.state === "paused"
  const [until, setUntil] = useState("")
  const [note, setNote] = useState("")
  const [asking, setAsking] = useState(false)
  const pause = useSave(pauseShop, "Shop paused. Buyers see when you're back.")
  const resume = useSave(unpauseShop, "You're open again 🎉")
  if (paused) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-2xl border-2 border-warning bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">Your shop is on a break</p>
          <p className="text-sm">
            Buyers can look but can't order
            {s.availability.pausedUntil ? ` until ${new Date(s.availability.pausedUntil).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}` : ""}.
          </p>
        </div>
        <Button variant="brand" size="lg" onClick={() => resume.mutate(undefined)} disabled={resume.isPending}>
          {resume.isPending ? <Spinner /> : <HugeiconsIcon icon={PlayIcon} data-icon="inline-start" />} Open my shop
        </Button>
      </div>
    )
  }
  if (!asking) {
    return (
      <div id="open" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card py-2.5 pr-2.5 pl-4">
        <p className="flex items-center gap-2 font-semibold text-success">
          <span className="size-2.5 rounded-full bg-success" aria-hidden /> Open — buyers can order
        </p>
        <Button variant="outline" onClick={() => setAsking(true)}>
          <HugeiconsIcon icon={PauseIcon} data-icon="inline-start" /> Take a break
        </Button>
      </div>
    )
  }
  return (
    <Section id="open" title="Take a break" description="Travelling or out of stock for a while? Pause instead of cancelling orders.">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pause-until">Back on (optional)</Label>
            <DatePicker id="pause-until" value={until || null} onChange={(v) => setUntil(v ?? "")} min={new Date()} placeholder="Not sure yet" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pause-note">Message for buyers (optional)</Label>
            <Input id="pause-note" maxLength={120} placeholder="Restocking — back soon!" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            disabled={pause.isPending}
            onClick={() => pause.mutate({ until: until ? new Date(`${until}T23:59`).toISOString() : null, note: note.trim() || null })}
          >
            {pause.isPending ? <Spinner /> : null} Pause my shop
          </Button>
          <Button size="lg" variant="ghost" onClick={() => setAsking(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </Section>
  )
}

// ─── Share ──────────────────────────────────────────────────────────────

export function ShareCard({ s, url }: { s: ShopSettings; url: string }) {
  const text = `Shop ${s.name} on alkemart 🛍️ ${url}`
  return (
    <Section id="share" title="Share your shop" description="Put this link in your TikTok and Instagram bio and your WhatsApp status.">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={url} aria-label="Your shop link" className="font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url)
                toast.success("Link copied")
              } catch {
                toast.error("Couldn't copy — press and hold the link instead.")
              }
            }}
          >
            <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" /> Copy
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
              <HugeiconsIcon icon={WhatsappIcon} data-icon="inline-start" /> WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </Section>
  )
}

// ─── Look ───────────────────────────────────────────────────────────────

export function ImageSlot({ label, url, kind, onSaved, wide }: { label: string; url: string | null; kind: "logos" | "banners"; onSaved: (u: string | null) => void; wide?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [pct, setPct] = useState<number | null>(null)
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn(
            "relative grid shrink-0 place-items-center overflow-hidden border-2 border-dashed bg-muted hover:border-foreground",
            wide ? "aspect-[3/1] w-full max-w-sm rounded-2xl" : "size-24 rounded-full",
          )}
          aria-label={url ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        >
          {url ? <img src={url} alt="" className="absolute inset-0 size-full object-cover" /> : <HugeiconsIcon icon={ImageUpload01Icon} className="size-6 text-muted-foreground" aria-hidden />}
          {pct != null ? <span className="absolute inset-0 grid place-items-center bg-background/80 text-sm font-bold tabular">{pct}%</span> : null}
        </button>
        {url && !wide ? (
          <Button variant="ghost" size="sm" onClick={() => onSaved(null)}>
            Remove
          </Button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ""
          if (!f) return
          setPct(0)
          try {
            onSaved(await uploadImage(f, setPct, kind))
          } catch (err) {
            toast.error(errText(err))
          } finally {
            setPct(null)
          }
        }}
      />
    </div>
  )
}

export function LookCard({ s }: { s: ShopSettings }) {
  const [name, setName] = useState(s.name)
  const [tagline, setTagline] = useState(s.storefront.tagline ?? "")
  const [bio, setBio] = useState(s.description ?? "")
  const image = useSave(saveProfile, "Looking good ✨")
  const words = useSave(
    async () => {
      if (name.trim() !== s.name) await saveProfile({ name: name.trim() })
      return saveStorefront({ tagline: tagline.trim() || null, bio: bio.trim() || null })
    },
    "Saved",
  )
  const dirty = name !== s.name || tagline !== (s.storefront.tagline ?? "") || bio !== (s.description ?? "")
  return (
    <Section id="look" title="Your look" description="Your logo and cover are the first thing buyers see.">
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <ImageSlot label="Logo" url={s.logo} kind="logos" onSaved={(logo) => image.mutate({ logo })} />
        <ImageSlot label="Cover photo" url={s.banner} kind="banners" wide onSaved={(banner) => image.mutate({ banner })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="shop-name">Shop name</Label>
        <Input id="shop-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="shop-tagline">Tagline</Label>
        <Input id="shop-tagline" maxLength={120} placeholder="Original phones & accessories, delivered fast in Accra" value={tagline} onChange={(e) => setTagline(e.target.value)} aria-describedby="tagline-hint" />
        <p id="tagline-hint" className="text-xs text-muted-foreground">
          One line under your name. {120 - tagline.length} characters left.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="shop-bio">About your shop</Label>
        <Textarea id="shop-bio" rows={4} maxLength={2000} placeholder="Who you are, what you sell, why buyers can trust you." value={bio} onChange={(e) => setBio(e.target.value)} />
        <p className="text-xs text-muted-foreground">No phone numbers or links here — buyers reach you through alkemart.</p>
      </div>
      <SaveButton show={dirty && name.trim().length > 0} pending={words.isPending} onClick={() => words.mutateAsync(undefined)} />
    </Section>
  )
}

// ─── Socials ────────────────────────────────────────────────────────────

const SOCIALS: { kind: SocialKind; label: string; icon: IconSvgElement; placeholder: string }[] = [
  { kind: "tiktok", label: "TikTok", icon: TiktokIcon, placeholder: "@yourshop" },
  { kind: "instagram", label: "Instagram", icon: InstagramIcon, placeholder: "@yourshop" },
  { kind: "facebook", label: "Facebook", icon: Facebook02Icon, placeholder: "yourshop or a facebook.com link" },
  { kind: "whatsapp", label: "WhatsApp", icon: WhatsappIcon, placeholder: "024 412 3456" },
]

/** Show "@handle" only when it maps back to exactly the stored link; else the link itself. */
function fieldValue(kind: SocialKind, url: string | undefined) {
  if (!url) return ""
  const handle = socialHandle(kind, url)
  const back = normalizeSocial(kind, handle)
  return back.ok && back.url === url ? handle : url.replace(/^https:\/\//, "")
}

export function SocialCard({ s }: { s: ShopSettings }) {
  const initial = Object.fromEntries(SOCIALS.map(({ kind }) => [kind, fieldValue(kind, s.contact.social[kind])])) as Record<SocialKind, string>
  const [vals, setVals] = useState(initial)
  const results = Object.fromEntries(SOCIALS.map(({ kind }) => [kind, normalizeSocial(kind, vals[kind])])) as Record<SocialKind, ReturnType<typeof normalizeSocial>>
  // Compare the links the text produces, not the text: "accramart" and "@accramart" are the same link.
  const changed = SOCIALS.filter(({ kind }) => {
    const r = results[kind]
    return !r.ok || (r.url ?? undefined) !== s.contact.social[kind]
  })
  const valid = SOCIALS.every(({ kind }) => results[kind].ok)
  const save = useSave(
    () => saveContact({ social: Object.fromEntries(changed.map(({ kind }) => [kind, results[kind].ok ? results[kind].url : null])) }),
    "Socials saved — they're on your shop page now",
  )
  return (
    <Section id="socials" title="Socials" description="Buyers trust shops they can check out on TikTok and Instagram. Your handles show on your shop page.">
      <div className="grid gap-4 sm:grid-cols-2">
        {SOCIALS.map(({ kind, label, icon, placeholder }) => {
          const r = results[kind]
          const id = `social-${kind}`
          return (
            <div key={kind} className="space-y-1.5">
              <Label htmlFor={id} className="flex items-center gap-1.5">
                <HugeiconsIcon icon={icon} className="size-4" aria-hidden /> {label}
              </Label>
              <Input
                id={id}
                inputMode={kind === "whatsapp" ? "tel" : "text"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={placeholder}
                value={vals[kind]}
                onChange={(e) => setVals((v) => ({ ...v, [kind]: e.target.value }))}
                aria-invalid={!r.ok || undefined}
                aria-describedby={`${id}-hint`}
              />
              <p id={`${id}-hint`} className={cn("min-h-4 truncate text-xs", r.ok ? "text-muted-foreground" : "text-destructive")}>
                {!r.ok ? r.message : r.url ? r.url.replace(/^https:\/\//, "") : ""}
              </p>
            </div>
          )
        })}
      </div>
      <SaveButton show={changed.length > 0} pending={save.isPending} onClick={() => (valid ? save.mutateAsync(undefined) : Promise.reject(toast.error("Fix the highlighted link first.")))} />
    </Section>
  )
}

// ─── Delivery ───────────────────────────────────────────────────────────

const DISPATCH_LABEL: Record<number, string> = { 2: "2 hours", 6: "6 hours", 12: "Same day", 24: "Next day", 48: "2 days", 72: "3 days" }

export function Stepper({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-lg" aria-label={`${label}: one less`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <HugeiconsIcon icon={MinusSignIcon} />
        </Button>
        <Input id={id} inputMode="numeric" className="w-16 text-center text-lg font-bold tabular" value={value} onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""))
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }} />
        <Button variant="outline" size="icon-lg" aria-label={`${label}: one more`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <HugeiconsIcon icon={Add01Icon} />
        </Button>
      </div>
    </div>
  )
}

const ZONES: { key: DeliveryZoneKey; label: string; hint: string }[] = [
  { key: "town", label: "Same town", hint: "Buyers near your shop" },
  { key: "region", label: "Same region", hint: "Elsewhere in your region" },
  { key: "country", label: "Other regions", hint: "By bus or courier" },
]

type ZoneDraft = { on: boolean; fee: string }

export function DeliveryCard({ s }: { s: ShopSettings }) {
  const d = s.delivery
  const [minD, setMin] = useState(d.days?.min ?? 1)
  const [maxD, setMax] = useState(d.days?.max ?? 3)
  const [dispatch, setDispatch] = useState(d.dispatchHours ?? 24)
  const initialZones = Object.fromEntries(
    ZONES.map(({ key }) => {
      const v = s.fulfillment.delivery[key]
      return [key, { on: v != null, fee: v == null ? "" : minorToMajorText(v) }]
    }),
  ) as Record<DeliveryZoneKey, ZoneDraft>
  const [zones, setZones] = useState(initialZones)
  const [pickup, setPickup] = useState(s.fulfillment.pickup)
  const parsed = Object.fromEntries(ZONES.map(({ key }) => [key, zones[key].on ? parseMajorToMinor(zones[key].fee, { allowZero: true }) : null])) as Record<
    DeliveryZoneKey,
    string | null
  >
  const feeBad = ZONES.some(({ key }) => zones[key].on && parsed[key] == null)
  const noWay = !pickup && ZONES.every(({ key }) => !zones[key].on)
  const promiseDirty = !d.days || minD !== d.days.min || maxD !== d.days.max || dispatch !== (d.dispatchHours ?? 24)
  const zonesDirty = pickup !== s.fulfillment.pickup || ZONES.some(({ key }) => parsed[key] !== s.fulfillment.delivery[key])
  // One save for the promise and the prices: they're one decision for the seller.
  const save = useSave(async () => {
    let fresh = s
    if (promiseDirty) fresh = await saveDelivery({ days: { min: minD, max: Math.max(minD, maxD) }, dispatchHours: dispatch })
    if (zonesDirty) fresh = await saveFulfillment({ delivery: parsed, pickup })
    return fresh
  }, "Delivery saved")
  const range = minD === maxD ? `${minD}` : `${minD}–${Math.max(minD, maxD)}`
  const pickupPlace = [s.address?.district, s.address?.city].filter(Boolean).join(", ")
  return (
    <Section id="delivery" title="Delivery" description="What you promise and what it costs. Buyers see this before they pay, priced for where they are.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stepper id="days-min" label="Earliest day" value={minD} min={0} max={MAX_PROMISE_DAYS} onChange={(n) => { setMin(n); if (n > maxD) setMax(Math.max(1, n)) }} />
        <Stepper id="days-max" label="Latest day" value={maxD} min={Math.max(1, minD)} max={MAX_PROMISE_DAYS} onChange={setMax} />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">You hand orders to the rider within</legend>
        <ToggleGroup type="single" variant="outline" value={String(dispatch)} onValueChange={(v) => v && setDispatch(Number(v))} className="flex-wrap justify-start">
          {DISPATCH_HOUR_OPTIONS.map((h) => (
            <ToggleGroupItem key={h} value={String(h)} className="min-h-10 px-3.5">
              {DISPATCH_LABEL[h] ?? `${h} hours`}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Where you deliver, and the fee ({currencySymbol()})</legend>
        <ul className="divide-y rounded-2xl border">
          {ZONES.map(({ key, label, hint }) => {
            const z = zones[key]
            const bad = z.on && parsed[key] == null
            return (
              <li key={key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Switch
                  id={`zone-${key}`}
                  checked={z.on}
                  onCheckedChange={(on) => setZones((all) => ({ ...all, [key]: { on, fee: on && !all[key].fee ? "0" : all[key].fee } }))}
                />
                <label htmlFor={`zone-${key}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm text-muted-foreground">{z.on ? hint : "You don't deliver here"}</span>
                </label>
                {z.on ? (
                  <Input
                    aria-label={`${label} delivery fee`}
                    inputMode="decimal"
                    className="w-28 tabular"
                    value={z.fee}
                    onChange={(e) => setZones((all) => ({ ...all, [key]: { ...all[key], fee: e.target.value } }))}
                    aria-invalid={bad || undefined}
                  />
                ) : null}
              </li>
            )
          })}
          <li className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Switch id="pickup" checked={pickup} onCheckedChange={setPickup} />
            <label htmlFor="pickup" className="min-w-0 flex-1 cursor-pointer">
              <span className="block font-semibold">Pickup from your shop</span>
              <span className="block text-sm text-muted-foreground">
                {pickup ? `Free. Buyers collect${pickupPlace ? ` in ${pickupPlace}` : ""} with their pickup code.` : "Off"}
              </span>
            </label>
          </li>
        </ul>
        <p className={cn("text-xs", feeBad || noWay ? "text-destructive" : "text-muted-foreground")}>
          {noWay ? "Turn on at least one way for buyers to get their order." : feeBad ? "Enter a fee like 30 or 30.50 — 0 for free delivery." : "0 means free delivery."}
        </p>
      </fieldset>

      <p className="rounded-xl bg-muted p-3 text-sm">
        Buyers will see: <strong>“Delivers in {range} day{maxD === 1 ? "" : "s"}”</strong> and the fee for their area. Promise what you can keep — late orders hurt your shop.
      </p>
      <SaveButton
        show={promiseDirty || zonesDirty}
        pending={save.isPending}
        onClick={() => (feeBad || noWay ? Promise.reject(toast.error(noWay ? "Turn on delivery somewhere, or pickup." : "Fix the delivery fee first.")) : save.mutateAsync(undefined))}
      />
    </Section>
  )
}

// ─── Contact & hours ────────────────────────────────────────────────────

const DAY_PRESETS = [
  { value: "Mon-Fri", label: "Mon–Fri" },
  { value: "Mon-Sat", label: "Mon–Sat" },
  { value: "Daily", label: "Every day" },
]

/** 024 412 3456 → +233244123456; +… kept. */
function toE164(v: string) {
  const d = v.replace(/[^\d+]/g, "")
  if (!d) return ""
  if (d.startsWith("+")) return d
  return d.startsWith("0") ? GHANA_COUNTRY_CODE + d.slice(1) : `+${d}`
}

export function ContactCard({ s }: { s: ShopSettings }) {
  const c = s.contact
  const [phone, setPhone] = useState(c.phone ?? "")
  const [days, setDays] = useState(c.hours?.days ?? "Mon-Sat")
  const [open, setOpen] = useState(c.hours?.open ?? "08:00")
  const [close, setClose] = useState(c.hours?.close ?? "18:00")
  const e164 = toE164(phone)
  const phoneOk = e164 === "" || /^\+[1-9]\d{6,14}$/.test(e164)
  const hoursOk = open < close
  const dirty = e164 !== (c.phone ?? "") || days !== (c.hours?.days ?? "") || open !== (c.hours?.open ?? "") || close !== (c.hours?.close ?? "")
  const save = useSave(() => saveContact({ phone: e164 || null, hours: { days, open, close } }), "Contact saved")
  return (
    <Section id="contact" title="Contact & opening hours" description="Shown on your shop page so buyers know when you'll reply.">
      <div className="space-y-1.5">
        <Label htmlFor="shop-phone">Shop phone (optional)</Label>
        <Input id="shop-phone" type="tel" inputMode="tel" placeholder="024 412 3456" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!phoneOk || undefined} aria-describedby="phone-hint" className="max-w-xs" />
        <p id="phone-hint" className={cn("text-xs", phoneOk ? "text-muted-foreground" : "text-destructive")}>
          {phoneOk ? "Buyers can tap to call." : "That number doesn't look right."}
        </p>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Open</legend>
        <ToggleGroup type="single" variant="outline" value={DAY_PRESETS.some((p) => p.value === days) ? days : ""} onValueChange={(v) => v && setDays(v)} className="flex-wrap justify-start">
          {DAY_PRESETS.map((p) => (
            <ToggleGroupItem key={p.value} value={p.value} className="min-h-10 px-3.5">
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="open-at">From</Label>
          <TimeSelect id="open-at" value={open} onChange={setOpen} className="w-36" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="close-at">To</Label>
          <TimeSelect id="close-at" value={close} onChange={setClose} className="w-36" invalid={!hoursOk} />
        </div>
      </div>
      {!hoursOk ? <p className="text-sm text-destructive">Closing time must be after opening time.</p> : null}
      <SaveButton show={dirty} pending={save.isPending} onClick={() => (phoneOk && hoursOk ? save.mutateAsync(undefined) : Promise.reject(toast.error("Fix the highlighted field first.")))} />
    </Section>
  )
}

// ─── Policies ───────────────────────────────────────────────────────────

const RETURN_OPTIONS = [0, 3, 7, 14, 30]

export function PolicyCard({ current, loading }: { current: PolicyBody | null; loading: boolean }) {
  if (loading) return <Skeleton className="h-48 rounded-2xl" />
  return <PolicyForm key={JSON.stringify(current)} current={current} />
}

function PolicyForm({ current }: { current: PolicyBody | null }) {
  const qc = useQueryClient()
  const [returnsDays, setReturns] = useState(current?.returnsDays ?? 7)
  const [warranty, setWarranty] = useState(current?.warranty ?? "")
  const [shipping, setShipping] = useState(current?.shipping ?? "")
  const dirty = !current || returnsDays !== current.returnsDays || warranty !== (current.warranty ?? "") || shipping !== (current.shipping ?? "")
  const save = useMutation({
    mutationFn: () => savePolicy({ returnsDays, ...(warranty.trim() ? { warranty: warranty.trim() } : {}), ...(shipping.trim() ? { shipping: shipping.trim() } : {}) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["policy"] })
      toast.success("Policy saved. New orders follow it; earlier orders keep the old one.")
    },
    onError: (e) => toast.error(errText(e)),
  })
  return (
    <Section id="policies" title="Returns & warranty" description="Clear policies mean fewer arguments. Each order keeps the policy it was placed under.">
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Buyers can return within</legend>
        <ToggleGroup type="single" variant="outline" value={String(returnsDays)} onValueChange={(v) => v && setReturns(Number(v))} className="flex-wrap justify-start">
          {RETURN_OPTIONS.map((d) => (
            <ToggleGroupItem key={d} value={String(d)} className="min-h-10 px-3.5">
              {d === 0 ? "No returns" : `${d} days`}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="warranty">Warranty (optional)</Label>
        <Textarea id="warranty" rows={2} maxLength={2000} placeholder="e.g. 6 months on phones — bring it back with the receipt." value={warranty} onChange={(e) => setWarranty(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="shipping">Delivery notes (optional)</Label>
        <Textarea id="shipping" rows={2} maxLength={2000} placeholder="e.g. We deliver across Accra and Tema; other regions by bus." value={shipping} onChange={(e) => setShipping(e.target.value)} />
      </div>
      <SaveButton show={dirty} pending={save.isPending} onClick={() => save.mutateAsync()}>
        Save policy
      </SaveButton>
    </Section>
  )
}

// ─── Search & sharing preview (replaces the old SEO page) ───────────────

export function SearchCard({ s, url }: { s: ShopSettings; url: string }) {
  const auto = (s.storefront.tagline ?? s.description ?? `Shop ${s.name} on alkemart.`).replace(/\s+/g, " ").slice(0, 160)
  const [custom, setCustom] = useState(s.storefront.seoDescription ?? "")
  const [editing, setEditing] = useState(!!s.storefront.seoDescription)
  const save = useSave(() => saveStorefront({ seoDescription: custom.trim() || null }), "Saved")
  const shown = custom.trim() || auto
  return (
    <Section id="search" title="On Google & when shared" description="We write this for you from your name and tagline. You only need to change it if you want to.">
      <div className="space-y-0.5 rounded-xl border p-4">
        <p className="truncate text-xs text-muted-foreground">{url.replace(/^https?:\/\//, "")}</p>
        <p className="truncate text-lg font-semibold text-info">{s.name} — shop on alkemart</p>
        <p className="line-clamp-2 text-sm text-muted-foreground">{shown}</p>
      </div>
      {editing ? (
        <div className="space-y-1.5">
          <Label htmlFor="seo-desc">Your own description</Label>
          <Textarea id="seo-desc" rows={2} maxLength={160} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={auto} />
          <p className="text-xs text-muted-foreground">{160 - custom.length} characters left. Leave empty to use the automatic one.</p>
          <SaveButton show={custom !== (s.storefront.seoDescription ?? "")} pending={save.isPending} onClick={() => save.mutateAsync(undefined)} />
        </div>
      ) : (
        <Button variant="outline" size="lg" onClick={() => setEditing(true)}>
          Write my own
        </Button>
      )}
    </Section>
  )
}

// ─── Location ───────────────────────────────────────────────────────────

const regionIdOf = (v: string | null | undefined) => GHANA_REGIONS.find((r) => r.name === v || r.id === v)?.id ?? ""

export function LocationCard({ s }: { s: ShopSettings }) {
  const a = s.address
  const saved = {
    pin: a?.latitude != null && a?.longitude != null ? { lat: a.latitude, lng: a.longitude } : null,
    region: regionIdOf(a?.province),
    city: a?.city ?? "",
    area: a?.district ?? "",
    landmark: a?.address_1 ?? "",
    gps: a?.postal_code ?? "",
  }
  const [pin, setPin] = useState<Pin | null>(saved.pin)
  const [region, setRegion] = useState(saved.region)
  const [city, setCity] = useState(saved.city)
  const [area, setArea] = useState(saved.area)
  const [landmark, setLandmark] = useState(saved.landmark)
  const [gps, setGps] = useState(saved.gps)
  const [editPlace, setEditPlace] = useState(!saved.pin && !!saved.region)
  const gpsOk = gps.trim() === "" || /^[A-Z]{2}-?\d{3,4}-?\d{3,4}$/i.test(gps.trim())
  const dirty =
    pin?.lat !== saved.pin?.lat ||
    pin?.lng !== saved.pin?.lng ||
    region !== saved.region ||
    city !== saved.city ||
    area !== saved.area ||
    landmark !== saved.landmark ||
    gps !== saved.gps
  const save = useSave(
    () =>
      saveDispatchAddress({
        pack_region: region || null,
        city: city.trim() || null,
        district: area.trim() || null,
        address_1: landmark.trim() || null,
        digital_address: gps.trim().toUpperCase() || null,
        latitude: pin?.lat ?? null,
        longitude: pin?.lng ?? null,
      }),
    "Location saved. Buyers nearby now see how far you are.",
  )
  // The map fills town, area and region; the seller can still correct them.
  const fromMap = (next: Pin, place: Place | null) => {
    setPin(next)
    if (!place) return
    if (place.regionId) setRegion(place.regionId)
    setCity(place.city ?? "")
    setArea(place.area ?? "")
  }
  const regionName = GHANA_REGIONS.find((r) => r.id === region)?.name
  const summary = [area, city, regionName].filter(Boolean).join(", ")
  return (
    <Section
      id="location"
      title="Where you dispatch from"
      description="Pin your shop so buyers see real distance and riders find you. Buyers see your area and town; the landmark is for riders only."
    >
      <LocationPicker apiBase={getApiUrl()} value={pin} onChange={fromMap} subject="your shop" />

      <div className="space-y-3 rounded-2xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">Buyers see</p>
            <p className="text-[15px] font-semibold">{summary || "No area yet"}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditPlace((v) => !v)} aria-expanded={editPlace}>
            {editPlace ? "Done" : "Not right? Edit"}
          </Button>
        </div>
        {editPlace ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="loc-region">Region</Label>
              <select id="loc-region" value={region} onChange={(e) => setRegion(e.target.value)} className="h-10 w-full rounded-4xl border bg-input/30 px-3 text-sm">
                <option value="">Choose a region</option>
                {GHANA_REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-city">Town or city</Label>
              <Input id="loc-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Madina" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-area">Area</Label>
              <Input id="loc-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Zongo Junction" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <div className="space-y-1.5">
          <Label htmlFor="loc-landmark">Landmark for riders (private)</Label>
          <Input id="loc-landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Blue gate behind the Shell station" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc-gps">GhanaPost GPS (optional)</Label>
          <Input id="loc-gps" value={gps} onChange={(e) => setGps(e.target.value)} placeholder="GA-183-8164" autoCapitalize="characters" aria-invalid={!gpsOk || undefined} aria-describedby="loc-gps-hint" />
          <p id="loc-gps-hint" className={cn("text-xs", gpsOk ? "text-muted-foreground" : "text-destructive")}>
            {gpsOk ? "Riders can use it too." : "Looks like GA-183-8164."}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Selling from home? Pin a nearby landmark instead of your house — buyers see the pin's distance, riders get the landmark.</p>
      <SaveButton
        show={dirty}
        pending={save.isPending}
        onClick={() =>
          !region
            ? Promise.reject(toast.error("Pin your shop or choose your region first."))
            : !gpsOk
              ? Promise.reject(toast.error("Fix the GhanaPost GPS code first."))
              : save.mutateAsync(undefined)
        }
      >
        Save location
      </SaveButton>
    </Section>
  )
}

// ─── Where payouts go ───────────────────────────────────────────────────

const OPERATOR_TO_PROVIDER: Record<string, MomoProvider> = { MTN: "mtn", VODAFONE: "vodafone", AIRTELTIGO: "airteltigo" }

export type PayoutAccountView = { provider: string | null; phoneLast4: string } | null

export function PayoutCard({ account }: { account: PayoutAccountView }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(!account)
  const [phone, setPhone] = useState("")
  const [provider, setProvider] = useState<MomoProvider | "">("")
  const detected = OPERATOR_TO_PROVIDER[detectMobileOperator(phone) ?? ""]
  const chosen = provider || detected || ""
  const digits = phone.replace(/\D/g, "")
  const valid = !!chosen && (digits.length === 10 || (digits.startsWith("233") && digits.length === 12))
  const save = useMutation({
    mutationFn: () => savePayoutAccount({ provider: chosen as MomoProvider, phone }),
    onSuccess: (fresh) => {
      qc.setQueryData([...qk.seller, "full"], fresh)
      void qc.invalidateQueries({ queryKey: qk.statement })
      void qc.invalidateQueries({ queryKey: qk.seller })
      void qc.invalidateQueries({ queryKey: ["tasks"] })
      setEditing(false)
      setPhone("")
      setProvider("")
      toast.success("Payout number saved — Paystack confirmed it.")
    },
    onError: (e) => toast.error(errText(e)),
  })
  return (
    <Section id="payout-account" title="Where your payouts go" description="Payouts are sent only to this MoMo number. Paystack checks it before we save it.">
      {account && !editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-lg font-bold">
            <HugeiconsIcon icon={SmartPhone01Icon} className="size-5" aria-hidden />
            {PROVIDER_LABEL[account.provider ?? ""] ?? "MoMo"} · <span className="tabular">•••• {account.phoneLast4}</span>
          </p>
          <Button variant="outline" size="lg" onClick={() => setEditing(true)}>
            Change number
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="momo-phone">MoMo number</Label>
            <Input id="momo-phone" type="tel" inputMode="tel" placeholder="024 412 3456" className="max-w-xs" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">
              Network {detected && !provider ? <span className="font-normal text-muted-foreground">(we guessed from the number)</span> : null}
            </legend>
            <ToggleGroup type="single" variant="outline" value={chosen} onValueChange={(v) => setProvider((v || "") as MomoProvider | "")} className="flex-wrap justify-start">
              {(Object.keys(PROVIDER_LABEL) as MomoProvider[]).map((p) => (
                <ToggleGroupItem key={p} value={p} className="min-h-10 px-3.5">
                  {PROVIDER_LABEL[p]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>
          <p className="text-xs text-muted-foreground">Use a number registered in your or your business's name. Changes are recorded.</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <SaveButton
          show={editing && digits.length > 0}
          pending={save.isPending}
          onClick={() => (valid ? save.mutateAsync() : Promise.reject(toast.error("Enter a 10-digit MoMo number and pick the network.")))}
        >
          Save number
        </SaveButton>
        {account && editing ? (
          <Button size="lg" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </Section>
  )
}
