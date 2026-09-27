import { useCallback, useEffect, useId, useRef, useState } from "react"
import type * as Leaflet from "leaflet"
import { reversePlace, searchPlaces, type Pin, type Place } from "./places"

/**
 * Pick an exact spot: search a street or landmark, use the phone's GPS, or
 * move the map under the pin (the pin stays in the middle, like ride apps).
 * Every change resolves the street, area, town and region so the form around
 * it can fill itself in.
 *
 * Used for the seller's dispatch spot and the buyer's delivery spot. Leaflet
 * loads only when the picker is shown, so pages without it pay nothing.
 */

export type LocationPickerProps = {
  /** API origin; the picker calls `${apiBase}/store/places/*`. */
  apiBase: string
  value: Pin | null
  /** `place` is null while the street lookup is still running or failed. */
  onChange: (pin: Pin, place: Place | null) => void
  /** Words used in hints: "your shop" / "your delivery spot". */
  subject?: string
  /** Tile template; defaults to OpenStreetMap (light use only — set a provider for production). */
  tileUrl?: string
  tileAttribution?: string
  className?: string
}

const ACCRA: Pin = { lat: 5.6037, lng: -0.187 }
const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

type GpsState = { kind: "idle" } | { kind: "locating" } | { kind: "ok"; accuracy: number | null } | { kind: "error"; text: string }

export function LocationPicker({
  apiBase,
  value,
  onChange,
  subject = "your spot",
  tileUrl = OSM_TILES,
  tileAttribution = OSM_ATTRIBUTION,
  className,
}: LocationPickerProps) {
  const uid = useId()
  const mapEl = useRef<HTMLDivElement>(null)
  const map = useRef<Leaflet.Map | null>(null)
  /** Where our own setView is heading, so its moveend isn't taken as a drag. */
  const programmatic = useRef<Pin | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })
  const [ready, setReady] = useState(false)
  const [mapFailed, setMapFailed] = useState(false)
  const [place, setPlace] = useState<Place | null>(null)
  const [looking, setLooking] = useState(false)
  const [lookupFailed, setLookupFailed] = useState(false)
  const [gps, setGps] = useState<GpsState>({ kind: "idle" })
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reverseAbort = useRef<AbortController | null>(null)

  /** A new pin from any source: tell the parent now, then again with the street. */
  const settle = useCallback(
    (pin: Pin, known?: Place) => {
      clearTimeout(reverseTimer.current)
      reverseAbort.current?.abort()
      setLookupFailed(false)
      if (known) {
        setPlace(known)
        setLooking(false)
        onChangeRef.current(pin, known)
        return
      }
      setLooking(true)
      onChangeRef.current(pin, null)
      reverseTimer.current = setTimeout(() => {
        const ac = new AbortController()
        reverseAbort.current = ac
        reversePlace(apiBase, pin, ac.signal)
          .then((p) => {
            setPlace(p)
            setLooking(false)
            onChangeRef.current(pin, p)
          })
          .catch((e: unknown) => {
            if ((e as { name?: string }).name === "AbortError") return
            setPlace(null)
            setLooking(false)
            setLookupFailed(true)
          })
      }, 450)
    },
    [apiBase],
  )

  const flyTo = useCallback((pin: Pin, zoom = 17) => {
    const m = map.current
    if (!m) return
    programmatic.current = pin
    m.setView([pin.lat, pin.lng], zoom, { animate: true })
  }, [])

  // Build the map once.
  useEffect(() => {
    let disposed = false
    let instance: Leaflet.Map | null = null
    void Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")])
      .then(([mod]) => {
        const L = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet)
        if (disposed || !mapEl.current) return
        const start = value ?? ACCRA
        instance = L.map(mapEl.current, {
          center: [start.lat, start.lng],
          zoom: value ? 17 : 12,
          zoomControl: true,
          attributionControl: true,
          maxBounds: [
            [3.5, -4.5],
            [12.2, 2.5],
          ],
          minZoom: 6,
          // Scrolling the page over the map must scroll the page. The wheel
          // zooms only after the map is tapped or focused.
          scrollWheelZoom: false,
        })
        const wheelOn = () => instance!.scrollWheelZoom.enable()
        const wheelOff = () => instance!.scrollWheelZoom.disable()
        instance.on("click focus", wheelOn)
        instance.on("blur mouseout", wheelOff)
        L.tileLayer(tileUrl, { maxZoom: 19, attribution: tileAttribution }).addTo(instance)
        instance.on("moveend", () => {
          const c = instance!.getCenter()
          const target = programmatic.current
          programmatic.current = null
          if (target && Math.abs(target.lat - c.lat) < 1e-5 && Math.abs(target.lng - c.lng) < 1e-5) return
          settle({ lat: round(c.lat), lng: round(c.lng) })
        })
        map.current = instance
        setReady(true)
      })
      .catch(() => setMapFailed(true))
    return () => {
      disposed = true
      instance?.remove()
      map.current = null
    }
    // The map is built once; later value changes move it (below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Show the street for a pin that was already saved.
  const initial = useRef(value)
  useEffect(() => {
    const v = initial.current
    if (!v) return
    const ac = new AbortController()
    reversePlace(apiBase, v, ac.signal)
      .then(setPlace)
      .catch(() => undefined)
    return () => ac.abort()
  }, [apiBase])

  useEffect(() => () => clearTimeout(reverseTimer.current), [])

  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGps({ kind: "error", text: "This device can't share its location. Search or move the map instead." })
      return
    }
    setGps({ kind: "locating" })
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pin = { lat: round(p.coords.latitude), lng: round(p.coords.longitude) }
        if (!inGhana(pin)) {
          setGps({ kind: "error", text: "Your phone says you're outside Ghana. Search for the place instead." })
          return
        }
        setGps({ kind: "ok", accuracy: Number.isFinite(p.coords.accuracy) ? Math.round(p.coords.accuracy) : null })
        flyTo(pin)
        settle(pin)
      },
      (err) =>
        setGps({
          kind: "error",
          text:
            err.code === err.PERMISSION_DENIED
              ? "Location is blocked for this site. Allow it in your browser settings, or search instead."
              : "Couldn't get a GPS fix. Step outside or search instead.",
        }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    )
  }

  return (
    <div className={["space-y-3", className].filter(Boolean).join(" ")}>
      <PlaceSearch
        apiBase={apiBase}
        near={value}
        onPick={(p) => {
          const pin = { lat: p.lat, lng: p.lng }
          flyTo(pin)
          settle(pin, p)
        }}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={locate}
          disabled={gps.kind === "locating"}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border-2 border-foreground px-4 text-sm font-semibold transition-colors hover:bg-foreground hover:text-background disabled:opacity-60"
        >
          <GpsIcon className={gps.kind === "locating" ? "size-4 animate-pulse" : "size-4"} />
          {gps.kind === "locating" ? "Finding you…" : "Use my current location"}
        </button>
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {gps.kind === "ok"
            ? gps.accuracy != null && gps.accuracy > 60
              ? `GPS is rough here (about ${gps.accuracy} m). Nudge the map so the pin sits on ${subject}.`
              : `Found you${gps.accuracy != null ? ` to about ${gps.accuracy} m` : ""}. Nudge the map if the pin is off.`
            : gps.kind === "error"
              ? gps.text
              : "Works best standing at " + subject + "."}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
        <div
          ref={mapEl}
          className="h-64 w-full sm:h-80 [&_.leaflet-control-attribution]:text-[10px]"
          role="application"
          aria-label={`Map. Drag or use the arrow keys to move it; the pin in the middle marks ${subject}.`}
          aria-describedby={`${uid}-where`}
        />
        {/* The pin is fixed to the middle; the map moves under it. */}
        <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center" aria-hidden>
          <div className="-translate-y-1/2">
            <PinIcon className={["size-10 drop-shadow-md transition-transform", looking ? "-translate-y-1" : ""].join(" ")} />
          </div>
        </div>
        {!ready ? (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            {mapFailed ? "The map didn't load. You can still search above." : "Loading map…"}
          </div>
        ) : null}
      </div>

      <div id={`${uid}-where`} className="flex items-start gap-3 rounded-2xl bg-muted/60 p-3" aria-live="polite">
        <PinIcon className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 text-sm">
          {!value ? (
            <p className="text-muted-foreground">No pin yet. Search, use your location, or move the map.</p>
          ) : looking ? (
            <p className="text-muted-foreground">Finding the street…</p>
          ) : place ? (
            <>
              <p className="font-semibold">{place.label}</p>
              {place.detail ? <p className="text-muted-foreground">{place.detail}</p> : null}
            </>
          ) : (
            <p className="text-muted-foreground">
              {lookupFailed ? "Pinned. We couldn't name the street, but riders get the exact spot." : "Pinned."}
            </p>
          )}
          {value ? (
            <a
              href={mapsLink(value)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex min-h-6 items-center text-xs font-semibold underline-offset-4 hover:underline"
            >
              Check it in Google Maps<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Search ─────────────────────────────────────────────────────────────

function PlaceSearch({ apiBase, near, onPick }: { apiBase: string; near: Pin | null; onPick: (p: Place) => void }) {
  const uid = useId()
  const [q, setQ] = useState("")
  const [results, setResults] = useState<Place[]>([])
  const [state, setState] = useState<"idle" | "searching" | "done" | "error">("idle")
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const nearRef = useRef(near)
  useEffect(() => {
    nearRef.current = near
  })

  useEffect(() => {
    const term = q.trim()
    if (term.length < 3) {
      setResults([])
      setState("idle")
      return
    }
    const ac = new AbortController()
    const t = setTimeout(() => {
      setState("searching")
      searchPlaces(apiBase, term, nearRef.current, ac.signal)
        .then((r) => {
          setResults(r)
          setActive(-1)
          setState("done")
        })
        .catch((e: unknown) => {
          if ((e as { name?: string }).name !== "AbortError") setState("error")
        })
    }, 500)
    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [q, apiBase])

  const pick = (p: Place) => {
    onPick(p)
    setQ(p.label)
    setOpen(false)
  }

  const listId = `${uid}-results`
  const showList = open && q.trim().length >= 3
  return (
    <div className="space-y-2">
      <label htmlFor={`${uid}-q`} className="text-sm font-medium">
        Search a street, landmark or area
      </label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={`${uid}-q`}
          type="search"
          role="combobox"
          aria-expanded={showList && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          placeholder="e.g. Madina Zongo Junction"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!results.length) return
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setOpen(true)
              setActive((i) => (i + 1) % results.length)
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
            } else if (e.key === "Enter") {
              e.preventDefault()
              const p = results[active >= 0 ? active : 0]
              if (p) pick(p)
            } else if (e.key === "Escape") {
              setOpen(false)
            }
          }}
          className="h-11 w-full rounded-full border border-input bg-background pr-4 pl-10 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
      {/* Inline, not a floating popover: results push the map down. */}
      {showList ? (
        state === "searching" && !results.length ? (
          <p className="px-1 text-sm text-muted-foreground">Searching…</p>
        ) : state === "error" ? (
          <p className="px-1 text-sm text-muted-foreground">Search isn't answering right now. Move the map to your spot instead.</p>
        ) : state === "done" && !results.length ? (
          <p className="px-1 text-sm text-muted-foreground">Nothing found. Try a nearby landmark, or move the map.</p>
        ) : results.length ? (
          <ul id={listId} role="listbox" aria-label="Places found" className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {results.map((p, i) => (
              <li
                key={`${p.lat},${p.lng},${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                className={[
                  "flex min-h-12 cursor-pointer items-start gap-3 px-3.5 py-2.5 text-sm",
                  i === active ? "bg-muted" : "hover:bg-muted/60",
                ].join(" ")}
              >
                <PinIcon className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-semibold">{p.label}</span>
                  {p.detail ? <span className="block truncate text-muted-foreground">{p.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null
      ) : null}
    </div>
  )
}

// ─── Bits ───────────────────────────────────────────────────────────────

const round = (n: number) => Math.round(n * 1e6) / 1e6
const inGhana = (p: Pin) => p.lat >= 4 && p.lat <= 11.8 && p.lng >= -3.8 && p.lng <= 1.8

/** Opens the spot in Google Maps (riders' default app). */
export const mapsLink = (p: Pin) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Z" className="fill-foreground" />
      <circle cx="12" cy="9" r="2.6" className="fill-background" />
    </svg>
  )
}

function GpsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}
