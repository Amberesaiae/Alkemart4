import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { useBlocker } from "@tanstack/react-router"
import { useSellerProfile, useUpdateStorefront, usePauseShop, useUnpauseShop, useShopPolicies, useSavePolicy, useCategories, useProducts, useUpdateDisplay, useUpdateContact, useFeatured, useSetFeatured } from "../lib/hooks"
import type { StorefrontPatch } from "../lib/api"
import { Card, Button, Input, Label, Select, Textarea, Skeleton, DatePicker } from "@workspace/ui"
import { format } from "date-fns"
import { PageShell } from "../components/page-shell"
import { PageHeader } from "../components/page-header"
import {
  Storefront,
  DeviceMobile,
  DeviceTablet,
  ArrowSquareOut,
  CheckCircle,
  WarningCircle,
  Pause,
  Play,
  ClipboardText,
  Eye,
  Megaphone,
  Tag,
  ShieldCheck,
  X,
  PhoneCall,
  CalendarBlank,
  Clock,
  InstagramLogo,
  TiktokLogo,
  FacebookLogo,
  WhatsappLogo,
} from "@phosphor-icons/react"
import { toast } from "sonner"

export const Route = createFileRoute('/store')({
  component: StorePage,
})

/** Storefront origin for the live preview iframe. Same default as local dev. */
function storefrontBase(): string {
  const raw = (import.meta.env.VITE_ALKEMART_STOREFRONT_URL as string | undefined)?.trim()
  return (raw ? raw : "http://127.0.0.1:5175").replace(/\/$/, "")
}

const BLOCKED_PHRASES = ["send money", "momo pin", "mpesa pin", "whatsapp me", "counterfeit", "replica"]

function hasUrl(v: string): boolean {
  return /https?:\/\//i.test(v) || /(^|\s)www\./i.test(v)
}

function blockedPhrase(v: string): string | null {
  const lower = v.toLowerCase()
  return BLOCKED_PHRASES.find((p) => lower.includes(p)) ?? null
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type CardKey = "branding" | "announcement" | "seo"

function StorePage() {
  const { data, isLoading, isError, refetch } = useSellerProfile()
  const seller = data?.seller
  const update = useUpdateStorefront()

  const saved = useMemo(() => ({
    tagline: seller?.storefront?.tagline ?? "",
    bio: (seller?.description as string | null | undefined) ?? "",
    announcementText: seller?.storefront?.announcement?.text ?? "",
    startsAt: toLocalInput(seller?.storefront?.announcement?.startsAt ?? null),
    endsAt: toLocalInput(seller?.storefront?.announcement?.endsAt ?? null),
    announcementEnabled: seller?.storefront?.announcement != null,
    seoDescription: seller?.storefront?.seoDescription ?? "",
  }), [seller])

  const [form, setForm] = useState(saved)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop")
  const [activeCategory, setActiveCategory] = useState<"branding" | "catalog" | "operations">("branding")
  const [showPreview, setShowPreview] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => { setForm(saved) }, [saved])

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v }))

  const dirty = useMemo(() => ({
    branding: form.tagline !== saved.tagline || form.bio !== saved.bio,
    announcement:
      form.announcementEnabled !== saved.announcementEnabled ||
      form.announcementText !== saved.announcementText ||
      form.startsAt !== saved.startsAt ||
      form.endsAt !== saved.endsAt,
    seo: form.seoDescription !== saved.seoDescription,
  }), [form, saved])
  const anyDirty = dirty.branding || dirty.announcement || dirty.seo

  // Warn on reload / in-app navigation with unsaved edits.
  useEffect(() => {
    if (!anyDirty) return
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", onUnload)
    return () => window.removeEventListener("beforeunload", onUnload)
  }, [anyDirty])
  useBlocker({ shouldBlockFn: () => (anyDirty ? !window.confirm("You have unsaved store edits. Leave anyway?") : false) })

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {}
    if (form.tagline.length > 120) next.tagline = "Tagline must be 120 characters or fewer."
    if (form.bio.length > 2000) next.bio = "Bio must be 2000 characters or fewer."
    if (form.seoDescription.length > 160) next.seoDescription = "SEO description must be 160 characters or fewer."
    for (const [key, value] of [["tagline", form.tagline], ["bio", form.bio], ["seoDescription", form.seoDescription]] as const) {
      if (!value) continue
      if (hasUrl(value)) next[key] = "Links are not allowed here."
      else {
        const hit = blockedPhrase(value)
        if (hit) next[key] = `This text was flagged for review (“${hit}”).`
      }
    }
    if (form.announcementEnabled) {
      if (!form.announcementText.trim()) next.announcementText = "Announcement text is required."
      else if (form.announcementText.length > 140) next.announcementText = "Announcement must be 140 characters or fewer."
      else if (hasUrl(form.announcementText)) next.announcementText = "Links are not allowed here."
      else {
        const hit = blockedPhrase(form.announcementText)
        if (hit) next.announcementText = `This text was flagged for review (“${hit}”).`
      }
      const starts = Date.parse(form.startsAt)
      const ends = Date.parse(form.endsAt)
      if (!form.startsAt || !Number.isFinite(starts)) next.startsAt = "Choose a start date."
      if (!form.endsAt || !Number.isFinite(ends)) next.endsAt = "Choose an end date."
      if (Number.isFinite(starts) && Number.isFinite(ends) && !(ends > starts)) {
        next.endsAt = "End must be after the start."
      }
    }
    return next
  }

  const handlePublish = async () => {
    const found = validate()
    setErrors(found)
    setSavedFlash(false)
    if (Object.keys(found).length > 0) {
      document.getElementById("store-error-summary")?.focus()
      return
    }
    const patch: StorefrontPatch = {}
    if (dirty.branding) {
      patch.tagline = form.tagline.trim() === "" ? null : form.tagline.trim()
      patch.bio = form.bio.trim() === "" ? null : form.bio.trim()
    }
    if (dirty.announcement) {
      patch.announcement = form.announcementEnabled
        ? {
          text: form.announcementText.trim(),
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
        }
        : null
    }
    if (dirty.seo) {
      patch.seoDescription = form.seoDescription.trim() === "" ? null : form.seoDescription.trim()
    }
    try {
      await update.mutateAsync(patch)
      setLastSavedAt(new Date().toLocaleString())
      setSavedFlash(true)
      toast.success("Store published — buyers see it now.")
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish.")
    }
  }

  const cardStatus = (key: CardKey) =>
    update.isPending ? "publishing" : dirty[key] ? "unsaved" : "saved"

  const statusPill = (key: CardKey) => {
    const s = cardStatus(key)
    return (
      <span
        className={
          s === "saved"
            ? "ml-auto text-xs font-bold uppercase tracking-wide text-success"
            : s === "publishing"
              ? "ml-auto text-xs font-bold uppercase tracking-wide text-muted-foreground"
              : "ml-auto text-xs font-bold uppercase tracking-wide text-warning-fg"
        }
      >
        {s === "saved" ? "Saved" : s === "publishing" ? "Publishing…" : "Unsaved"}
      </span>
    )
  }

  const shopUrl = seller?.handle ? `${storefrontBase()}/shops/${seller.handle}` : null
  const errorEntries = Object.entries(errors)

  if (isLoading) {
    return (
      <PageShell>
        <PageHeader title="Store" description="Your buyer-visible shop page." />
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-6 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
              </Card>
            ))}
          </div>
          <Skeleton className="h-[560px] w-full" />
        </div>
      </PageShell>
    )
  }

  if (isError || !seller) {
    return (
      <PageShell>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center justify-between">
          <span>Failed to load your store.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell className="space-y-6">
      {/* Top Page Header with Preview Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Store"
          description="Branding, catalog merchandising, announcements, and policies for your live shop."
        />
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={showPreview ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPreview((p) => !p)}
            className="gap-1.5 font-bold shadow-xs cursor-pointer"
          >
            <Eye className="h-4 w-4" />
            <span>{showPreview ? "Hide Preview" : "Live Preview"}</span>
          </Button>
          {shopUrl && (
            <a
              href={shopUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition shadow-xs"
            >
              <ArrowSquareOut className="h-3.5 w-3.5 text-primary" />
              Open Live Shop
            </a>
          )}
        </div>
      </div>

      {/* Category Navigation Bar */}
      <div
        role="tablist"
        aria-label="Store sections"
        className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-muted/50 dark:bg-muted/20 border border-border/80 rounded-2xl"
      >
        <button
          role="tab"
          id="tab-branding"
          aria-selected={activeCategory === "branding"}
          onClick={() => setActiveCategory("branding")}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left cursor-pointer ${
            activeCategory === "branding"
              ? "bg-card text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40"
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
              activeCategory === "branding"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Megaphone className="h-5 w-5" weight={activeCategory === "branding" ? "bold" : "regular"} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold truncate">Brand & Marketing</span>
              {anyDirty && (
                <span className="flex h-2 w-2 rounded-full bg-warning ring-2 ring-background" title="Unsaved edits" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate font-medium">Tagline, announcement & SEO</p>
          </div>
        </button>

        <button
          role="tab"
          id="tab-catalog"
          aria-selected={activeCategory === "catalog"}
          onClick={() => setActiveCategory("catalog")}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left cursor-pointer ${
            activeCategory === "catalog"
              ? "bg-card text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40"
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
              activeCategory === "catalog"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Tag className="h-5 w-5" weight={activeCategory === "catalog" ? "bold" : "regular"} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold truncate">Catalog & Display</span>
            </div>
            <p className="text-xs text-muted-foreground truncate font-medium">Stock mode, order & shelf</p>
          </div>
        </button>

        <button
          role="tab"
          id="tab-operations"
          aria-selected={activeCategory === "operations"}
          onClick={() => setActiveCategory("operations")}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left cursor-pointer ${
            activeCategory === "operations"
              ? "bg-card text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40"
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
              activeCategory === "operations"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <ShieldCheck className="h-5 w-5" weight={activeCategory === "operations" ? "bold" : "regular"} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold truncate">Policies & Operations</span>
            </div>
            <p className="text-xs text-muted-foreground truncate font-medium">Vacation mode, returns & contact</p>
          </div>
        </button>
      </div>

      {errorEntries.length > 0 && (
        <div
          id="store-error-summary"
          tabIndex={-1}
          role="alert"
          className="p-4 rounded-xl border-2 border-destructive/40 bg-destructive/10 focus:outline-none focus:ring-2 focus:ring-destructive"
        >
          <h2 className="font-black flex items-center gap-2 text-destructive">
            <WarningCircle className="h-5 w-5" /> Fix {errorEntries.length} problem{errorEntries.length > 1 ? "s" : ""} to publish
          </h2>
          <ul className="mt-2 list-disc pl-5 text-sm font-medium">
            {errorEntries.map(([field, message]) => (
              <li key={field}>
                <a href={`#store-field-${field}`} className="underline">{message}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {savedFlash && (
        <p role="status" className="text-sm font-bold text-success flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> Published — buyers see the update now.
        </p>
      )}

      {/* Sticky publish bar for Brand & Marketing edits */}
      {activeCategory === "branding" && (
        <div className="sticky top-0 z-10 -mx-1 px-3 py-2.5 bg-background/95 backdrop-blur flex flex-wrap items-center gap-3 border rounded-xl shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground" aria-live="polite">
            <span>Branding: {cardStatus("branding")}</span>
            <span aria-hidden="true">·</span>
            <span>Announcement: {cardStatus("announcement")}</span>
            <span aria-hidden="true">·</span>
            <span>SEO: {cardStatus("seo")}</span>
          </div>
          {lastSavedAt && (
            <span className="text-xs text-muted-foreground font-medium">Last published {lastSavedAt}</span>
          )}
          <Button
            size="sm"
            className="ml-auto gap-2 font-bold px-5"
            disabled={!anyDirty || update.isPending}
            isLoading={update.isPending}
            onClick={() => { void handlePublish() }}
          >
            <Storefront className="h-4 w-4" /> Publish changes
          </Button>
        </div>
      )}

      {/* Main Content Area: Left Cards, Right Toggleable Live Preview */}
      <div className={showPreview ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] items-start" : "space-y-6 max-w-4xl"}>
        <div className="space-y-6 min-w-0">
          {/* ── Category 1: Brand & Marketing ── */}
          {activeCategory === "branding" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="space-y-6">
                {/* Branding */}
                <Card id="store-branding" className="p-6 space-y-4 scroll-mt-24 shadow-xs">
                  <h2 className="font-bold flex items-center gap-2 text-base text-foreground">
                    <Storefront className="h-5 w-5 text-primary" /> Shop Branding {statusPill("branding")}
                  </h2>
                  <div className="space-y-2">
                    <Label htmlFor="store-field-tagline">Tagline <span className="text-xs text-muted-foreground font-normal">({form.tagline.length}/120)</span></Label>
                    <Input
                      id="store-field-tagline"
                      value={form.tagline}
                      maxLength={121}
                      placeholder="e.g. Accra's freshest market"
                      onChange={(e) => set("tagline", e.target.value)}
                      aria-invalid={Boolean(errors.tagline)}
                      aria-describedby={errors.tagline ? "store-field-tagline-error" : undefined}
                    />
                    {errors.tagline && <p id="store-field-tagline-error" className="text-xs font-medium text-destructive">{errors.tagline}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store-field-bio">Shop bio <span className="text-xs text-muted-foreground font-normal">({form.bio.length}/2000)</span></Label>
                    <Textarea
                      id="store-field-bio"
                      value={form.bio}
                      rows={4}
                      placeholder="Tell buyers who you are…"
                      onChange={(e) => set("bio", e.target.value)}
                      aria-invalid={Boolean(errors.bio)}
                      aria-describedby={errors.bio ? "store-field-bio-error" : undefined}
                    />
                    {errors.bio && <p id="store-field-bio-error" className="text-xs font-medium text-destructive">{errors.bio}</p>}
                  </div>
                </Card>

                {/* SEO */}
                <Card id="store-seo" className="p-6 space-y-4 scroll-mt-24 shadow-xs">
                  <h2 className="font-bold flex items-center gap-2 text-base text-foreground">
                    <Storefront className="h-5 w-5 text-primary" /> Search (SEO) {statusPill("seo")}
                  </h2>
                  <div className="space-y-2">
                    <Label htmlFor="store-field-seoDescription">Shop description <span className="text-xs text-muted-foreground font-normal">({form.seoDescription.length}/160)</span></Label>
                    <Textarea
                      id="store-field-seoDescription"
                      value={form.seoDescription}
                      rows={3}
                      maxLength={161}
                      placeholder="One or two sentences for search results…"
                      onChange={(e) => set("seoDescription", e.target.value)}
                      aria-invalid={Boolean(errors.seoDescription)}
                      aria-describedby={errors.seoDescription ? "store-field-seoDescription-error" : undefined}
                    />
                    {errors.seoDescription && <p id="store-field-seoDescription-error" className="text-xs font-medium text-destructive">{errors.seoDescription}</p>}
                  </div>
                  <div className="rounded-xl border p-3.5 bg-muted/30" aria-label="Search result preview">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Search Preview</p>
                    <p className="font-semibold text-sm text-primary leading-snug truncate">
                      {seller.name}{form.tagline.trim() ? ` — ${form.tagline.trim()}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      alkemart.com/shops/{seller.handle}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {form.seoDescription.trim() || "Add a shop description above to control this snippet."}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Announcement */}
              <div className="space-y-6">
                <Card id="store-announcement" className="p-6 space-y-4 scroll-mt-24 shadow-xs">
                  <h2 className="font-bold flex items-center gap-2 text-base text-foreground">
                    <Megaphone className="h-5 w-5 text-primary" /> Announcement Banner {statusPill("announcement")}
                  </h2>
                  <label className="flex items-center gap-2.5 text-sm font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.announcementEnabled}
                      onChange={(e) => set("announcementEnabled", e.target.checked)}
                      className="h-4 w-4 accent-primary rounded cursor-pointer"
                    />
                    Display an announcement banner on my shop
                    {seller.storefront?.announcementActive && (
                      <span className="text-[11px] font-bold uppercase tracking-wider text-success ml-auto">Live now</span>
                    )}
                  </label>
                  {form.announcementEnabled && (
                    <div className="space-y-4 pt-2 border-t border-border/60">
                      <div className="space-y-2">
                        <Label htmlFor="store-field-announcementText">Banner message <span className="text-xs text-muted-foreground font-normal">({form.announcementText.length}/140)</span></Label>
                        <Textarea
                          id="store-field-announcementText"
                          value={form.announcementText}
                          rows={2}
                          maxLength={141}
                          placeholder="e.g. Harvest sale this weekend — 10% off yams"
                          onChange={(e) => set("announcementText", e.target.value)}
                          aria-invalid={Boolean(errors.announcementText)}
                          aria-describedby={errors.announcementText ? "store-field-announcementText-error" : undefined}
                        />
                        {errors.announcementText && <p id="store-field-announcementText-error" className="text-xs font-medium text-destructive">{errors.announcementText}</p>}
                      </div>

                      {/* Proper shadcn DatePicker components */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="store-field-startsAt" className="text-xs font-semibold">
                            Start Date
                          </Label>
                          <DatePicker
                            id="store-field-startsAt"
                            value={form.startsAt}
                            onChange={(d) => set("startsAt", d ? format(d, "yyyy-MM-dd") : "")}
                            placeholder="Select start date"
                            aria-invalid={Boolean(errors.startsAt)}
                            aria-describedby={errors.startsAt ? "store-field-startsAt-error" : undefined}
                          />
                          {errors.startsAt && <p id="store-field-startsAt-error" className="text-xs font-medium text-destructive">{errors.startsAt}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="store-field-endsAt" className="text-xs font-semibold">
                            End Date
                          </Label>
                          <DatePicker
                            id="store-field-endsAt"
                            value={form.endsAt}
                            onChange={(d) => set("endsAt", d ? format(d, "yyyy-MM-dd") : "")}
                            placeholder="Select end date"
                            minDate={form.startsAt ? new Date(form.startsAt) : undefined}
                            aria-invalid={Boolean(errors.endsAt)}
                            aria-describedby={errors.endsAt ? "store-field-endsAt-error" : undefined}
                          />
                          {errors.endsAt && <p id="store-field-endsAt-error" className="text-xs font-medium text-destructive">{errors.endsAt}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* ── Category 2: Catalog & Display ── */}
          {activeCategory === "catalog" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <DisplayCard />
              <FeaturedCard />
            </div>
          )}

          {/* ── Category 3: Policies & Operations ── */}
          {activeCategory === "operations" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                <AvailabilityCard />
                <PoliciesCard />
              </div>
              <ContactCard />
            </div>
          )}
        </div>

        {/* ── Live Preview Side Panel (Toggleable) ── */}
        {showPreview && (
          <div id="store-preview" className="xl:sticky xl:top-16 space-y-3 animate-in fade-in slide-in-from-right-3 duration-200">
            <div className="flex items-center justify-between gap-2 p-2 bg-muted/40 rounded-xl border border-border">
              <div className="inline-flex rounded-lg border p-0.5 bg-background shadow-2xs" role="group" aria-label="Preview device size">
                <Button
                  size="sm"
                  variant={previewMode === "desktop" ? "default" : "ghost"}
                  onClick={() => setPreviewMode("desktop")}
                  aria-pressed={previewMode === "desktop"}
                  className="gap-1 text-xs h-7 px-2.5 cursor-pointer"
                >
                  <DeviceTablet className="h-3.5 w-3.5" /> Desktop
                </Button>
                <Button
                  size="sm"
                  variant={previewMode === "mobile" ? "default" : "ghost"}
                  onClick={() => setPreviewMode("mobile")}
                  aria-pressed={previewMode === "mobile"}
                  className="gap-1 text-xs h-7 px-2.5 cursor-pointer"
                >
                  <DeviceMobile className="h-3.5 w-3.5" /> Mobile
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                {shopUrl && (
                  <a
                    href={shopUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md hover:bg-muted text-foreground transition"
                  >
                    Open <ArrowSquareOut className="h-3 w-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                  title="Close preview"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div
              className="mx-auto rounded-2xl border-2 overflow-hidden bg-card transition-[max-width] motion-reduce:transition-none shadow-md"
              style={{ maxWidth: previewMode === "mobile" ? 390 : "100%" }}
            >
              {shopUrl ? (
                <iframe
                  key={shopUrl}
                  title="Live preview of your shop"
                  src={shopUrl}
                  className="w-full h-[580px] bg-background"
                  loading="lazy"
                />
              ) : (
                <p className="p-8 text-sm text-muted-foreground font-medium text-center">
                  Set a shop handle in Settings to preview your live page.
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium text-center">
              Preview renders your real shop page — publish to update what buyers see.
            </p>
          </div>
        )}
      </div>
    </PageShell>
  )
}

function AvailabilityCard() {
  const { data, refetch } = useSellerProfile()
  const seller = data?.seller
  const pause = usePauseShop()
  const unpause = useUnpauseShop()
  const [note, setNote] = useState("")
  const [until, setUntil] = useState("")

  const availability = seller?.availability
  const paused = availability?.state === "paused"

  const handlePause = async () => {
    if (until) {
      const t = Date.parse(until)
      if (!Number.isFinite(t) || t <= Date.now()) {
        toast.error("Return date must be in the future.")
        return
      }
    }
    try {
      await pause.mutateAsync({
        note: note.trim() === "" ? null : note.trim(),
        until: until === "" ? null : new Date(until).toISOString(),
      })
      toast.success("Shop paused — orders are paused until you resume.")
      setNote("")
      setUntil("")
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pause shop.")
    }
  }

  const handleResume = async () => {
    try {
      await unpause.mutateAsync()
      toast.success("Welcome back — your shop is open for orders.")
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resume.")
    }
  }

  return (
    <Card id="store-availability" className="p-6 space-y-4 shadow-xs flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2 text-base text-foreground">
            <Pause className="h-5 w-5 text-primary" /> Availability & Vacation
          </h2>
          <span
            className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
              paused ? "bg-warning/20 text-warning-fg" : "bg-success/20 text-success"
            }`}
          >
            {paused ? "Paused" : "Open"}
          </span>
        </div>

        {paused ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-xs space-y-1">
              <p className="font-bold text-warning-fg">Order intake is currently paused.</p>
              {availability?.note && <p className="text-warning-fg/90">{availability.note}</p>}
              {availability?.pausedUntil && (
                <p className="text-warning-fg/80 font-medium">
                  Reopening: {new Date(availability.pausedUntil).toLocaleDateString()}
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Listings stay visible to buyers, but checkout is paused.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="store-pause-note">Pause Notice (optional)</Label>
              <Input
                id="store-pause-note"
                value={note}
                maxLength={500}
                placeholder="e.g. Taking stock, back Monday"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-pause-until" className="text-xs font-semibold">
                Reopen Date (optional)
              </Label>
              <DatePicker
                id="store-pause-until"
                value={until}
                onChange={(d) => setUntil(d ? format(d, "yyyy-MM-dd") : "")}
                placeholder="Select reopen date"
                minDate={new Date()}
              />
            </div>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-border/60">
        {paused ? (
          <Button onClick={() => { void handleResume() }} isLoading={unpause.isPending} className="w-full gap-2">
            <Play className="h-4 w-4" /> Resume Orders
          </Button>
        ) : (
          <Button variant="outline" onClick={() => { void handlePause() }} isLoading={pause.isPending} className="w-full gap-2">
            <Pause className="h-4 w-4" /> Pause Orders
          </Button>
        )}
      </div>
    </Card>
  )
}

function PoliciesCard() {
  const { data: policyData } = useShopPolicies()
  const save = useSavePolicy()
  const current = policyData?.current

  const [shipping, setShipping] = useState<string | null>(null)
  const [returnsDays, setReturnsDays] = useState<string | null>(null)
  const [warranty, setWarranty] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const shippingValue = shipping ?? (current?.body.shipping ?? "")
  const returnsValue = returnsDays ?? (current?.body.returnsDays != null ? String(current.body.returnsDays) : "")
  const warrantyValue = warranty ?? (current?.body.warranty ?? "")
  const dirty = shipping !== null || returnsDays !== null || warranty !== null

  const handleSave = async () => {
    const parsed = returnsValue.trim() === "" ? undefined : Number(returnsValue)
    if (parsed !== undefined && (!Number.isInteger(parsed) || parsed < 0 || parsed > 365)) {
      toast.error("Returns window must be 0 to 365 days (0 = final sale).")
      return
    }
    try {
      await save.mutateAsync({
        ...(shippingValue.trim() ? { shipping: shippingValue.trim() } : {}),
        ...(parsed !== undefined ? { returnsDays: parsed } : {}),
        ...(warrantyValue.trim() ? { warranty: warrantyValue.trim() } : {}),
      })
      setShipping(null)
      setReturnsDays(null)
      setWarranty(null)
      setSavedFlash(true)
      toast.success("Policies published.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save policies.")
    }
  }

  return (
    <Card id="store-policies" className="p-6 space-y-4 shadow-xs flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2 text-base text-foreground">
            <ClipboardText className="h-5 w-5 text-primary" /> Shop Policies
          </h2>
          {current && (
            <span className="text-[11px] text-muted-foreground font-mono">v{current.version} active</span>
          )}
        </div>

        {savedFlash && (
          <p role="status" className="text-xs font-bold text-success flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" /> Policies updated successfully.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="store-policy-shipping">Shipping Dispatch Note</Label>
          <Input
            id="store-policy-shipping"
            value={shippingValue}
            placeholder="e.g. Dispatched within 24 hours"
            onChange={(e) => { setShipping(e.target.value); setSavedFlash(false) }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="store-policy-returns">Returns Window (Days)</Label>
          <Input
            id="store-policy-returns"
            type="number"
            min={0}
            max={365}
            step={1}
            value={returnsValue}
            placeholder="7 (0 for final sale)"
            onChange={(e) => { setReturnsDays(e.target.value); setSavedFlash(false) }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="store-policy-warranty">Warranty Note</Label>
          <Input
            id="store-policy-warranty"
            value={warrantyValue}
            placeholder="e.g. 6-month replacement guarantee"
            onChange={(e) => { setWarranty(e.target.value); setSavedFlash(false) }}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-border/60">
        <Button
          onClick={() => { void handleSave() }}
          disabled={!dirty || save.isPending}
          isLoading={save.isPending}
          className="w-full"
        >
          Publish Policies
        </Button>
      </div>
    </Card>
  )
}

function DisplayCard() {
  const { data: profile } = useSellerProfile()
  const { data: categoriesData } = useCategories()
  const update = useUpdateDisplay()
  const seller = profile?.seller
  const categories = categoriesData?.product_categories ?? []
  const savedOrder = seller?.display?.categoryOrder ?? []
  const savedFeaturedCat = seller?.display?.featuredCategoryId ?? ""
  const savedStockMode = seller?.display?.stockMode ?? "exact"

  const [order, setOrder] = useState<string[] | null>(null)
  const [featuredCat, setFeaturedCat] = useState<string | null>(null)
  const [stockMode, setStockMode] = useState<"exact" | "bands" | null>(null)
  const [addId, setAddId] = useState("")
  const [savedFlash, setSavedFlash] = useState(false)

  const orderValue = order ?? savedOrder
  const featuredValue = featuredCat ?? savedFeaturedCat
  const stockValue = stockMode ?? savedStockMode
  const dirty =
    order !== null || featuredCat !== null || stockMode !== null

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...orderValue]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    const [item] = next.splice(idx, 1)
    next.splice(j, 0, item!)
    setOrder(next)
    setSavedFlash(false)
  }

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        categoryOrder: order ?? undefined,
        featuredCategoryId: featuredCat !== null ? (featuredCat === "" ? null : featuredCat) : undefined,
        stockMode: stockMode ?? undefined,
      })
      setOrder(null)
      setFeaturedCat(null)
      setStockMode(null)
      setSavedFlash(true)
      toast.success("Catalog display saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save display.")
    }
  }

  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? id

  return (
    <Card id="store-display" className="p-6 space-y-4 scroll-mt-24">
      <h2 className="font-black flex items-center gap-2">
        <Storefront className="h-5 w-5 text-primary" /> Catalog display
        {dirty ? (
          <span className="ml-auto text-xs font-bold uppercase tracking-wide text-warning-fg">Unsaved</span>
        ) : (
          <span className="ml-auto text-xs font-bold uppercase tracking-wide text-success">Saved</span>
        )}
      </h2>
      {savedFlash && (
        <p role="status" className="text-sm font-bold text-success flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> Display preferences saved.
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="store-display-stock">Stock display</Label>
        <Select
          id="store-display-stock"
          value={stockValue}
          onChange={(e) => { setStockMode(e.target.value as "exact" | "bands"); setSavedFlash(false) }}
        >
          <option value="exact">Exact counts</option>
          <option value="bands">Bands (Low stock / In stock)</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="store-display-featured-cat">Featured category (optional)</Label>
        <Select
          id="store-display-featured-cat"
          value={featuredValue}
          onChange={(e) => { setFeaturedCat(e.target.value); setSavedFlash(false) }}
        >
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Category order</Label>
        {orderValue.length === 0 ? (
          <p className="text-sm text-muted-foreground font-medium">Default taxonomy order. Add categories to pin them first.</p>
        ) : (
          <ul className="space-y-1">
            {orderValue.map((id, i) => (
              <li key={id} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium">
                <span className="font-bold text-muted-foreground tabular-nums">{i + 1}.</span>
                <span className="flex-1 truncate">{nameOf(id)}</span>
                <button type="button" aria-label={`Move ${nameOf(id)} up`} disabled={i === 0} onClick={() => move(i, -1)} className="font-bold px-1 disabled:opacity-30">▲</button>
                <button type="button" aria-label={`Move ${nameOf(id)} down`} disabled={i === orderValue.length - 1} onClick={() => move(i, 1)} className="font-bold px-1 disabled:opacity-30">▼</button>
                <button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => { setOrder(orderValue.filter((x) => x !== id)); setSavedFlash(false) }} className="font-bold px-1 text-destructive">✕</button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Select aria-label="Add category to order" value={addId} onChange={(e) => setAddId(e.target.value)} className="flex-1">
            <option value="">Add a category…</option>
            {categories.filter((c) => !orderValue.includes(c.id)).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Button
            variant="outline"
            disabled={!addId}
            onClick={() => { if (addId) { setOrder([...orderValue, addId]); setAddId(""); setSavedFlash(false) } }}
          >
            Add
          </Button>
        </div>
      </div>
      <Button onClick={() => { void handleSave() }} disabled={!dirty || update.isPending} isLoading={update.isPending}>
        Save display
      </Button>
    </Card>
  )
}

function FeaturedCard() {
  const { data: featuredData } = useFeatured()
  const { data: productsData } = useProducts({ limit: 100 })
  const save = useSetFeatured()
  const savedIds = featuredData?.productIds ?? []
  const allProducts = productsData?.products ?? []

  const [ids, setIds] = useState<string[] | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const value = ids ?? savedIds
  const dirty = ids !== null

  const titleOf = (id: string) => allProducts.find((p) => p.id === id)?.title ?? id

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...value]
    const j = idx + dir
    if (j < 0 || j >= next.length) return
    const [item] = next.splice(idx, 1)
    next.splice(j, 0, item!)
    setIds(next)
    setSavedFlash(false)
  }

  const toggle = (id: string) => {
    if (value.includes(id)) {
      setIds(value.filter((x) => x !== id))
    } else {
      if (value.length >= 8) {
        toast.error("The shelf holds at most 8 products.")
        return
      }
      setIds([...value, id])
    }
    setSavedFlash(false)
  }

  const handleSave = async () => {
    try {
      await save.mutateAsync(value)
      setIds(null)
      setSavedFlash(true)
      toast.success("Featured shelf published.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shelf.")
    }
  }

  return (
    <Card id="store-featured" className="p-6 space-y-4 scroll-mt-24">
      <h2 className="font-black flex items-center gap-2">
        <Storefront className="h-5 w-5 text-primary" /> Featured shelf
        <span className="ml-auto text-xs font-bold text-muted-foreground tabular-nums">{value.length}/8</span>
      </h2>
      {savedFlash && (
        <p role="status" className="text-sm font-bold text-success flex items-center gap-2">
          <CheckCircle className="h-4 w-4" /> Shelf published — buyers see it first.
        </p>
      )}
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground font-medium">No featured products yet. Tick up to 8 below — rank 1 shows first.</p>
      ) : (
        <ol className="space-y-1">
          {value.map((id, i) => (
            <li key={id} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium">
              <span className="font-bold text-primary tabular-nums">#{i + 1}</span>
              <span className="flex-1 truncate">{titleOf(id)}</span>
              <button type="button" aria-label={`Move ${titleOf(id)} up`} disabled={i === 0} onClick={() => move(i, -1)} className="font-bold px-1 disabled:opacity-30">▲</button>
              <button type="button" aria-label={`Move ${titleOf(id)} down`} disabled={i === value.length - 1} onClick={() => move(i, 1)} className="font-bold px-1 disabled:opacity-30">▼</button>
              <button type="button" aria-label={`Remove ${titleOf(id)}`} onClick={() => toggle(id)} className="font-bold px-1 text-destructive">✕</button>
            </li>
          ))}
        </ol>
      )}
      <div className="space-y-2">
        <Label>Your products</Label>
        {allProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground font-medium">List a product first, then feature it here.</p>
        ) : (
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border p-2">
            {allProducts.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={value.includes(p.id)}
                    onChange={() => toggle(p.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="truncate">{p.title || "Untitled"}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button onClick={() => { void handleSave() }} disabled={!dirty || save.isPending} isLoading={save.isPending}>
        Publish shelf
      </Button>
    </Card>
  )
}

function ContactCard() {
  const { data } = useSellerProfile()
  const update = useUpdateContact()
  const saved = data?.seller?.contact

  const [phone, setPhone] = useState<string | null>(null)
  const [days, setDays] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [close, setClose] = useState<string | null>(null)
  const [instagram, setInstagram] = useState<string | null>(null)
  const [facebook, setFacebook] = useState<string | null>(null)
  const [tiktok, setTiktok] = useState<string | null>(null)
  const [whatsapp, setWhatsapp] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  const phoneValue = phone ?? (saved?.phone ?? "")
  const daysValue = days ?? (saved?.hours?.days ?? "")
  const openValue = open ?? (saved?.hours?.open ?? "")
  const closeValue = close ?? (saved?.hours?.close ?? "")
  const instagramValue = instagram ?? (saved?.social?.instagram ?? "")
  const facebookValue = facebook ?? (saved?.social?.facebook ?? "")
  const tiktokValue = tiktok ?? (saved?.social?.tiktok ?? "")
  const whatsappValue = whatsapp ?? (saved?.social?.whatsapp ?? "")
  const dirty =
    phone !== null || days !== null || open !== null || close !== null ||
    instagram !== null || facebook !== null || tiktok !== null || whatsapp !== null

  const handleSave = async () => {
    if (phoneValue.trim() !== "" && !/^\+[1-9]\d{6,14}$/.test(phoneValue.trim())) {
      toast.error("Phone must be E.164, e.g. +233241234567.")
      return
    }
    if ((daysValue || openValue || closeValue) && !(daysValue && openValue && closeValue)) {
      toast.error("Hours need days, opening, and closing time together.")
      return
    }
    try {
      await update.mutateAsync({
        phone: phone !== null ? (phoneValue.trim() === "" ? null : phoneValue.trim()) : undefined,
        hours: days !== null || open !== null || close !== null
          ? (daysValue && openValue && closeValue ? { days: daysValue, open: openValue, close: closeValue } : null)
          : undefined,
        social: instagram !== null || facebook !== null || tiktok !== null || whatsapp !== null
          ? {
            ...(instagram !== null ? { instagram: instagramValue.trim() || undefined } : {}),
            ...(facebook !== null ? { facebook: facebookValue.trim() || undefined } : {}),
            ...(tiktok !== null ? { tiktok: tiktokValue.trim() || undefined } : {}),
            ...(whatsapp !== null ? { whatsapp: whatsappValue.trim() || undefined } : {}),
          }
          : undefined,
      })
      setPhone(null); setDays(null); setOpen(null); setClose(null)
      setInstagram(null); setFacebook(null); setTiktok(null); setWhatsapp(null)
      setSavedFlash(true)
      toast.success("Contact details saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save contact.")
    }
  }

  return (
    <Card id="store-contact" className="p-6 space-y-6 scroll-mt-24 shadow-xs">
      <div className="flex items-center justify-between">
        <h2 className="font-bold flex items-center gap-2 text-base text-foreground">
          <PhoneCall className="h-5 w-5 text-primary" /> Contact & Operating Hours
        </h2>
        {dirty ? (
          <span className="text-xs font-bold uppercase tracking-wider text-warning">Unsaved</span>
        ) : (
          <span className="text-xs font-bold uppercase tracking-wider text-success">Saved</span>
        )}
      </div>

      {savedFlash && (
        <p role="status" className="text-xs font-bold text-success flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4" /> Contact details saved successfully.
        </p>
      )}

      {/* Direct Contact & Hours */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="store-contact-phone" className="flex items-center gap-1.5 text-sm font-semibold">
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
            Direct Phone <span className="text-xs font-normal text-muted-foreground">(E.164 format, e.g. +233241234567)</span>
          </Label>
          <Input
            id="store-contact-phone"
            value={phoneValue}
            placeholder="+233241234567"
            onChange={(e) => { setPhone(e.target.value); setSavedFlash(false) }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="store-contact-days" className="flex items-center gap-1.5 text-sm font-semibold">
              <CalendarBlank className="h-4 w-4 text-muted-foreground" />
              Operating Days
            </Label>
            <Input
              id="store-contact-days"
              value={daysValue}
              placeholder="e.g. Mon - Fri"
              onChange={(e) => { setDays(e.target.value); setSavedFlash(false) }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-contact-open" className="flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Opens
            </Label>
            <Input
              id="store-contact-open"
              type="time"
              value={openValue}
              onChange={(e) => { setOpen(e.target.value); setSavedFlash(false) }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-contact-close" className="flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Closes
            </Label>
            <Input
              id="store-contact-close"
              type="time"
              value={closeValue}
              onChange={(e) => { setClose(e.target.value); setSavedFlash(false) }}
            />
          </div>
        </div>
      </div>

      {/* Social Media Channels */}
      <div className="space-y-3 pt-4 border-t border-border/60">
        <h3 className="text-sm font-bold text-foreground">Social Channels</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Instagram */}
          <div className="space-y-1.5">
            <Label htmlFor="store-contact-instagram" className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#E4405F]/10">
                <InstagramLogo weight="fill" className="h-3.5 w-3.5 text-[#E4405F]" />
              </span>
              Instagram
            </Label>
            <Input
              id="store-contact-instagram"
              value={instagramValue}
              placeholder="https://instagram.com/yourshop"
              onChange={(e) => { setInstagram(e.target.value); setSavedFlash(false) }}
            />
          </div>

          {/* WhatsApp */}
          <div className="space-y-1.5">
            <Label htmlFor="store-contact-whatsapp" className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#25D366]/10">
                <WhatsappLogo weight="fill" className="h-3.5 w-3.5 text-[#25D366]" />
              </span>
              WhatsApp Link
            </Label>
            <Input
              id="store-contact-whatsapp"
              value={whatsappValue}
              placeholder="https://wa.me/233241234567"
              onChange={(e) => { setWhatsapp(e.target.value); setSavedFlash(false) }}
            />
          </div>

          {/* Facebook */}
          <div className="space-y-1.5">
            <Label htmlFor="store-contact-facebook" className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#1877F2]/10">
                <FacebookLogo weight="fill" className="h-3.5 w-3.5 text-[#1877F2]" />
              </span>
              Facebook
            </Label>
            <Input
              id="store-contact-facebook"
              value={facebookValue}
              placeholder="https://facebook.com/yourshop"
              onChange={(e) => { setFacebook(e.target.value); setSavedFlash(false) }}
            />
          </div>

          {/* TikTok */}
          <div className="space-y-1.5">
            <Label htmlFor="store-contact-tiktok" className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-foreground/10">
                <TiktokLogo weight="fill" className="h-3.5 w-3.5 text-foreground" />
              </span>
              TikTok
            </Label>
            <Input
              id="store-contact-tiktok"
              value={tiktokValue}
              placeholder="https://tiktok.com/@yourshop"
              onChange={(e) => { setTiktok(e.target.value); setSavedFlash(false) }}
            />
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-border/60">
        <Button
          onClick={() => { void handleSave() }}
          disabled={!dirty || update.isPending}
          isLoading={update.isPending}
        >
          Save Contact Details
        </Button>
      </div>
    </Card>
  )
}
