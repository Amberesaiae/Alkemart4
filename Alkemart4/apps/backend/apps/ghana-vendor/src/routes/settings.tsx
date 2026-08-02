import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { useSellerProfile, useUpdateProfile, useGhanaSetup, useUpdatePayment, useUploadImage } from "../lib/hooks"
import { Card, Button, Input, Label, Select, Skeleton } from "@workspace/ui"
import { PageShell } from "../components/page-shell"
import { PageHeader } from "../components/page-header"
import {
  GHANA_REGIONS,
  GHANA_UI,
  MOMO_NETWORKS,
  type MomoProvider,
  detectProvider,
  validatePhone,
  formatPhoneDisplay,
  normalizePhone,
  prefixHint,
} from "../lib/ghana"
import { Store, MapPin, CreditCard, Save, CheckCircle2, AlertCircle, Smartphone, Upload, X } from "lucide-react"

export const Route = createFileRoute('/settings')({
  validateSearch: (search: Record<string, unknown>) => {
    const result: { tab?: "profile" | "dispatch" | "momo" } = {}
    const raw = search.tab
    if (raw === "profile" || raw === "dispatch" || raw === "momo") result.tab = raw
    return result
  },
  component: SettingsPage,
})

function SettingsPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useSellerProfile()
  const seller = data?.seller
  const updateProfile = useUpdateProfile()
  const ghanaSetup    = useGhanaSetup()
  const updatePayment = useUpdatePayment()
  const upload        = useUploadImage()
  const { tab: searchTab } = Route.useSearch()

  const [activeTab, setActiveTab] = useState<"profile" | "dispatch" | "momo">("profile")

  useEffect(() => {
    if (searchTab) setActiveTab(searchTab)
  }, [searchTab])

  const [profileForm, setProfileForm] = useState({ name: "", handle: "" })
  const [addressForm, setAddressForm] = useState<{
    address_1: string
    address_2: string
    city: string
    province: string
    postal_code: string
    country_code: string
  }>({
    address_1: "",
    address_2: "",
    city: "",
    province: "",
    postal_code: "",
    country_code: "gh",
  })
  const [phoneRaw,  setPhoneRaw]  = useState("")
  const [provider,  setProvider]  = useState<MomoProvider>("mtn")
  const [phoneTouched, setPhoneTouched] = useState(false)

  const detectedProvider = detectProvider(phoneRaw)
  const phoneError       = phoneTouched ? validatePhone(phoneRaw) : null
  const phoneValid       = phoneTouched && phoneError === null && phoneRaw.trim() !== ""

  // Sync from server data
  useEffect(() => {
    if (!seller) return
    setProfileForm({ name: seller.name || "", handle: seller.handle || "" })
    if (seller.address) {
      setAddressForm({
        address_1:   seller.address.address_1   || "",
        address_2:   seller.address.address_2   || "",
        city:        seller.address.city        || "",
        province:    seller.address.province    || "",
        postal_code: seller.address.postal_code || "",
        country_code: "gh",
      })
    }
    if (seller.payment_details) {
      setPhoneRaw(seller.payment_details.phone || "")
      setProvider((seller.payment_details.provider as MomoProvider) || "mtn")
    }
  }, [seller])

  // Auto-detect provider when phone changes
  useEffect(() => {
    if (detectedProvider) setProvider(detectedProvider)
  }, [detectedProvider])

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfile.mutate(profileForm)
  }

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    ghanaSetup.mutate({
      address_1: addressForm.address_1,
      city: addressForm.city,
      region: addressForm.province,
      postal_code: addressForm.postal_code,
    })
  }

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPhoneTouched(true)
    const err = validatePhone(phoneRaw)
    if (err) return
    if (!seller) return
    updatePayment.mutate({
      id: seller.id,
      data: {
        type: "momo",
        phone: normalizePhone(phoneRaw), // E.164 — matches backend normalizePhoneForCountry
        provider,
      },
    })
  }

  if (isLoading) return (
    <PageShell className="max-w-4xl">
      <PageHeader title="Shop Settings" description="Configure your store details and payouts." />
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </PageShell>
  )
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-lg font-semibold text-destructive mb-2">Failed to load profile</h2>
        <p className="text-sm text-muted-foreground mb-4">Could not load your profile data. Please try again.</p>
        <button onClick={() => navigate({ to: "/settings", replace: true })} className="text-sm text-primary hover:underline">Try again</button>
      </div>
    )
  }

  const tabs = [
    { id: "profile"  as const, label: "Shop Profile",    icon: Store },
    { id: "dispatch" as const, label: "Dispatch Address", icon: MapPin },
    { id: "momo"     as const, label: "MoMo Payout",     icon: CreditCard },
  ]

  return (
    <PageShell className="max-w-4xl">
      <PageHeader title="Shop Settings" description="Configure your store details and payouts." />

      <div className="flex flex-col md:flex-row gap-8 items-start">

        {/* Tab nav */}
        <div className="w-full md:w-56 shrink-0 flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 scrollbar-none" role="tablist" aria-label="Settings sections">
          {tabs.map(tab => (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all w-full text-left whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 w-full min-w-0">

          {/* ── Shop Profile ── */}
          {activeTab === "profile" && (
            <Card className="p-6 border-2 shadow-sm" role="tabpanel" id="panel-profile" aria-labelledby="tab-profile">
              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <h2 className="text-lg font-black tracking-tight">Shop Profile</h2>

                <div className="space-y-2">
                  <Label>Shop Name</Label>
                  <Input
                    value={profileForm.name}
                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="e.g. Ama's Fresh Groceries"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Shop Handle (URL slug)</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border-2 border-r-0 border-border bg-muted text-muted-foreground text-sm font-medium shrink-0">
                      alkemart.com/
                    </span>
                    <Input
                      className="rounded-l-none"
                      value={profileForm.handle}
                      onChange={e => setProfileForm({
                        ...profileForm,
                        handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                      })}
                      placeholder="amas-groceries"
                    />
                  </div>
                   <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only</p>
                 </div>

                 <ImageUploader
                   label="Shop Logo"
                   alt={`${seller?.name ?? "Shop"} logo`}
                   current={seller?.logo ?? null}
                   onUpload={async (file) =>
                     upload.mutateAsync(file).then((url) =>
                       updateProfile.mutate({ logo: url }),
                     )
                   }
                   onRemove={() => updateProfile.mutate({ logo: null })}
                   isUploading={upload.isPending}
                 />

                 <ImageUploader
                   label="Cover Image"
                   alt={`${seller?.name ?? "Shop"} cover`}
                   current={seller?.banner ?? null}
                   onUpload={async (file) =>
                     upload.mutateAsync(file).then((url) =>
                       updateProfile.mutate({ banner: url }),
                     )
                   }
                   onRemove={() => updateProfile.mutate({ banner: null })}
                   isUploading={upload.isPending}
                 />

                 <StatusRow mutation={updateProfile} successText="Profile saved" />

                <div className="flex justify-end pt-2">
                  <Button type="submit" isLoading={updateProfile.isPending} className="gap-2 px-8">
                    <Save className="h-4 w-4" /> Save Profile
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* ── Dispatch Address ── */}
          {activeTab === "dispatch" && (
            <Card className="p-6 border-2 shadow-sm" role="tabpanel" id="panel-dispatch" aria-labelledby="tab-dispatch">
              <form onSubmit={handleAddressSubmit} className="space-y-5">
                <div>
                  <h2 className="text-lg font-black tracking-tight">Dispatch Address</h2>
                  <p className="text-muted-foreground text-sm font-medium mt-1">
                    Where should delivery riders pick up your orders?
                  </p>
                </div>

                {/* address_1 — mirrors operating-markets field */}
                <div className="space-y-2">
                  <Label>{/* operating-markets: "Street / house / area" */}Street / House / Area</Label>
                  <Input
                    value={addressForm.address_1}
                    onChange={e => setAddressForm({ ...addressForm, address_1: e.target.value })}
                    placeholder={GHANA_UI.addressPlaceholder}
                    required
                  />
                </div>

                {/* address_2 — landmark (operating-markets: "Landmark (optional)") */}
                <div className="space-y-2">
                  <Label>Landmark <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    value={addressForm.address_2}
                    onChange={e => setAddressForm({ ...addressForm, address_2: e.target.value })}
                    placeholder={GHANA_UI.landmarkPlaceholder}
                  />
                  <p className="text-xs text-muted-foreground">
                    Riders navigate by landmarks — include one whenever possible
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* city */}
                  <div className="space-y-2">
                    <Label>City / Town</Label>
                    <Input
                      value={addressForm.city}
                      onChange={e => setAddressForm({ ...addressForm, city: e.target.value })}
                      placeholder={GHANA_UI.cityPlaceholder}
                      required
                    />
                  </div>

                  {/* province — region dropdown, mirrors operating-markets province field */}
                  <div className="space-y-2">
                    <Label>Region</Label>
                    <Select
                      value={addressForm.province}
                      onChange={e => setAddressForm({ ...addressForm, province: e.target.value })}
                    >
                      <option value="" disabled>Select region</option>
                      {GHANA_REGIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* postal_code — GhanaPostGPS (optional) */}
                <div className="space-y-2">
                  <Label>{GHANA_UI.postalLabel}</Label>
                  <Input
                    value={addressForm.postal_code}
                    onChange={e => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                    placeholder={GHANA_UI.postalExample}
                    maxLength={12}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your GhanaPost digital address — helps riders find you precisely
                  </p>
                </div>

                <StatusRow mutation={ghanaSetup} successText="Ghana delivery setup complete" />

                <div className="flex justify-end pt-2">
                  <Button type="submit" isLoading={ghanaSetup.isPending} className="gap-2 px-8">
                    <Save className="h-4 w-4" /> Complete Delivery Setup
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* ── MoMo Payout ── */}
          {activeTab === "momo" && (
            <Card className="p-6 border-2 shadow-sm" role="tabpanel" id="panel-momo" aria-labelledby="tab-momo">
              <form onSubmit={handlePaymentSubmit} className="space-y-5">
                <div>
                  <h2 className="text-lg font-black tracking-tight">Mobile Money Payout</h2>
                  <p className="text-muted-foreground text-sm font-medium mt-1">
                    Where should Alkemart send your earnings?
                  </p>
                </div>

                {/* Phone — primary field; drives provider auto-detection */}
                <div className="space-y-2">
                  <Label>MoMo Number</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground select-none pointer-events-none">
                      +233
                    </span>
                    <Input
                      type="tel"
                      className="pl-14 pr-10"
                      value={phoneRaw}
                      onChange={e => setPhoneRaw(e.target.value)}
                      onBlur={() => setPhoneTouched(true)}
                      placeholder={GHANA_UI.phoneExample}
                      required
                      maxLength={13}
                      inputMode="numeric"
                    />
                    {phoneTouched && phoneRaw && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        {phoneValid
                          ? <CheckCircle2 className="h-5 w-5 text-success" />
                          : <AlertCircle className="h-5 w-5 text-destructive" />
                        }
                      </span>
                    )}
                  </div>

                  {phoneError && (
                    <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" /> {phoneError}
                    </p>
                  )}

                  {phoneValid && (
                    <p className="text-xs text-success font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      {formatPhoneDisplay(phoneRaw)}
                      {detectedProvider && ` — ${MOMO_NETWORKS[detectedProvider].label}`}
                    </p>
                  )}
                </div>

                {/* Network selector — auto-set from prefix, overrideable */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Network
                    {detectedProvider && (
                      <span className="ml-auto text-xs font-normal text-muted-foreground">
                        Auto-detected from your number
                      </span>
                    )}
                  </Label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(Object.entries(MOMO_NETWORKS) as [MomoProvider, { label: string; prefixes: string[] }][]).map(([key, net]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setProvider(key)}
                        aria-pressed={provider === key}
                        className={`relative flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${
                          provider === key
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        {provider === key && (
                          <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-primary" />
                        )}
                        <span className="font-black text-sm leading-tight">{net.label}</span>
                        <span className="text-xs text-muted-foreground mt-1.5 font-medium">
                          {prefixHint(key)}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Mismatch warning */}
                  {detectedProvider && detectedProvider !== provider && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 text-warning text-xs font-semibold border border-warning/20">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
                      <span>
                        Your number prefix suggests <strong>{MOMO_NETWORKS[detectedProvider].label}</strong>,
                        but you selected <strong>{MOMO_NETWORKS[provider].label}</strong>.
                        Double-check before saving.
                      </span>
                    </div>
                  )}
                </div>

                <StatusRow mutation={updatePayment} successText="Payout details saved" />

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    isLoading={updatePayment.isPending}
                    disabled={phoneTouched && !!phoneError}
                    className="gap-2 px-8"
                  >
                    <Save className="h-4 w-4" /> Save Payout Details
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  )
}

// ---------------------------------------------------------------------------
// Image upload control — reuses /vendor/uploads (R2-backed Medusa file service)
// and persists the returned URL via POST /vendor/sellers/me { logo | banner }.
// ---------------------------------------------------------------------------

type ImageUploaderProps = {
  label: string
  alt: string
  current: string | null | undefined
  onUpload: (file: File) => Promise<void> | void
  onRemove: () => void
  isUploading: boolean
}

function ImageUploader({
  label,
  alt,
  current,
  onUpload,
  onRemove,
  isUploading,
}: ImageUploaderProps) {
  const [prev, setPrev] = useState<string | null>(current ?? null)
  const [error, setError] = useState<string | null>(null)

  // Reflect server-saved value (e.g. after a successful save or a refetch).
  useEffect(() => {
    setPrev(current ?? null)
  }, [current])

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const okTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"]
    if (!okTypes.includes(file.type)) {
      setError("Only PNG, JPG, WebP, or GIF images are accepted.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5 MB.")
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setPrev(objectUrl)
    try {
      await onUpload(file)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.")
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }

  const clear = () => {
    setPrev(null)
    onRemove()
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {prev ? (
        <div className="relative inline-block">
          <img
            src={prev}
            alt={alt}
            className={`rounded-xl object-cover ring-1 ring-border ${
              label.toLowerCase().includes("cover")
                ? "h-28 w-64"
                : "h-20 w-20"
            }`}
          />
          <button
            type="button"
            onClick={clear}
            disabled={isUploading}
            className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5 text-white/90 hover:bg-destructive/90"
            aria-label={`Remove ${label.toLowerCase()}`}
            title={`Remove ${label.toLowerCase()}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition hover:border-primary hover:text-primary">
          <Upload className="h-5 w-5" />
          <input
            type="file"
            accept="image/*"
            onChange={onChange}
            disabled={isUploading}
            className="sr-only"
            aria-label={label}
          />
        </label>
      )}

      {error ? (
        <p className="text-xs text-destructive font-semibold">{error}</p>
      ) : null}
      {isUploading ? (
        <p className="text-xs text-muted-foreground">Uploading…</p>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared status row
// ---------------------------------------------------------------------------

function StatusRow({
  mutation,
  successText,
}: {
  mutation: { isPending?: boolean; isSuccess: boolean; isError: boolean }
  successText: string
}) {
  const [visible, setVisible] = useState<"success" | "error" | null>(null)

  useEffect(() => {
    if (mutation.isPending) {
      setVisible(null)
      return
    }
    if (mutation.isSuccess) setVisible("success")
    else if (mutation.isError) setVisible("error")
  }, [mutation.isPending, mutation.isSuccess, mutation.isError])

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setVisible(null), 6000)
    return () => clearTimeout(t)
  }, [visible])

  if (!visible) return null
  if (visible === "success") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success text-sm font-semibold border border-success/20" role="status">
        <CheckCircle2 className="h-4 w-4 shrink-0" /> {successText}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20" role="alert">
      <AlertCircle className="h-4 w-4 shrink-0" /> Could not save — try again
    </div>
  )
}
