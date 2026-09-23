import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useEffect, useRef } from "react"
import { useSellerProfile, useUpdateProfile, useUpdateAddress, useUpdatePayment, useUploadImage, useAlertPrefs, useSetAlertPref } from "../lib/hooks"
import { Card, CardHeader, CardTitle, CardContent, CardFooter, Button, Input, Label, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui"
import { PageShell } from "../components/page-shell"
import { PageHeader } from "../components/page-header"
import {
  GHANA_REGIONS,
  GHANA_UI,
  MOMO_NETWORKS,
  districtsOf,
  type MomoProvider,
  detectProvider,
  validatePhone,
  formatPhoneDisplay,
  normalizePhone,
} from "../lib/ghana"
import { detectLiveLocality } from "../lib/live-location"
import {
  Storefront,
  MapPin,
  CreditCard,
  FloppyDisk,
  CheckCircle,
  WarningCircle,
  DeviceMobile,
  X,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ArrowSquareOut,
  NavigationArrow,
} from "@phosphor-icons/react"

export const Route = createFileRoute('/settings')({
  validateSearch: (search: Record<string, unknown>) => {
    const result: { tab?: "profile" | "dispatch" | "momo" | "alerts" } = {}
    const raw = search.tab
    if (raw === "profile" || raw === "dispatch" || raw === "momo" || raw === "alerts") result.tab = raw
    return result
  },
  component: SettingsPage,
})

type StepTab = "profile" | "dispatch" | "momo" | "alerts"

const STEPS: { id: StepTab; label: string; number: number }[] = [
  { id: "profile", label: "Shop Profile", number: 1 },
  { id: "dispatch", label: "Dispatch Address", number: 2 },
  { id: "momo", label: "MoMo Payout", number: 3 },
  { id: "alerts", label: "Alerts", number: 4 },
]

function SettingsPage() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useSellerProfile()
  const seller = data?.seller
  const updateProfile = useUpdateProfile()
  const updateAddress = useUpdateAddress()
  const updatePayment = useUpdatePayment()
  const upload        = useUploadImage()
  const { tab: searchTab } = Route.useSearch()

  const [activeTab, setActiveTab] = useState<StepTab>("profile")

  useEffect(() => {
    if (searchTab) setActiveTab(searchTab)
  }, [searchTab])

  const [profileForm, setProfileForm] = useState({ name: "", handle: "" })
  const [addressForm, setAddressForm] = useState<{
    address_1: string
    address_2: string
    city: string
    district: string
    province: string
    postal_code: string
    country_code: string
    delivery_fee_ghs: string
    latitude: number | null
    longitude: number | null
  }>({
    address_1: "",
    address_2: "",
    city: "",
    district: "",
    province: "",
    postal_code: "",
    country_code: "gh",
    delivery_fee_ghs: "",
    latitude: null,
    longitude: null,
  })
  const [phoneRaw, setPhoneRaw]       = useState("")
  const [provider, setProvider]       = useState<MomoProvider>("mtn")
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [locating, setLocating]       = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)

  const handleLiveLocation = async () => {
    setLocating(true)
    setLocateError(null)
    try {
      const loc = await detectLiveLocality()
      setAddressForm(f => ({
        ...f,
        city: loc.city || f.city,
        province: loc.region || f.province,
        district: loc.district || (loc.region && loc.region !== f.province ? "" : f.district),
        latitude: loc.latitude,
        longitude: loc.longitude,
      }))
    } catch (err) {
      setLocateError(err instanceof Error ? err.message : "Could not read location")
    } finally {
      setLocating(false)
    }
  }

  const detectedProvider = detectProvider(phoneRaw)
  const phoneError       = phoneTouched ? validatePhone(phoneRaw) : null
  const phoneValid       = phoneTouched && phoneError === null && phoneRaw.trim() !== ""

  // Sync from server data
  useEffect(() => {
    if (!seller) return
    setProfileForm({ name: seller.name || "", handle: seller.handle || "" })
    if (seller.address) {
      const sellerMeta = (seller.metadata as Record<string, unknown> | undefined)
      setAddressForm({
        address_1:   seller.address.address_1   || "",
        address_2:   seller.address.address_2   || "",
        city:        seller.address.city        || "",
        district:    seller.address.district    || "",
        province:    seller.address.province    || "",
        postal_code: seller.address.postal_code || "",
        country_code: "gh",
        delivery_fee_ghs: sellerMeta?.delivery_fee_ghs != null ? String(sellerMeta.delivery_fee_ghs) : "",
        latitude:  typeof seller.address.latitude === "number"  ? seller.address.latitude  : null,
        longitude: typeof seller.address.longitude === "number" ? seller.address.longitude : null,
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
    if (!seller) return
    const fee = parseFloat(addressForm.delivery_fee_ghs)
    updateAddress.mutate({
      id: seller.id,
      data: {
        ...addressForm,
        delivery_fee_pesewas: !isNaN(fee) && fee >= 0 ? String(Math.round(fee * 100)) : undefined,
      },
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
        phone: normalizePhone(phoneRaw),
        provider,
      },
    })
  }

  if (isLoading) {
    return (
      <PageShell className="max-w-3xl">
        <PageHeader title="Settings" description="Configure your store details and payouts." />
        <div className="space-y-4 mt-6">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </PageShell>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <WarningCircle className="h-10 w-10 text-destructive mb-2" />
        <h2 className="text-lg font-bold text-foreground mb-1">Failed to load settings</h2>
        <p className="text-sm text-muted-foreground mb-4">Could not retrieve your store profile data.</p>
        <Button onClick={() => navigate({ to: "/settings", replace: true })} variant="outline" size="sm">
          Retry
        </Button>
      </div>
    )
  }

  const activeIndex = STEPS.findIndex(s => s.id === activeTab)

  return (
    <PageShell className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader title="Settings" description="Configure your store details and payouts." />
        {profileForm.handle && (
          <a
            href={`https://alkemart.com/${profileForm.handle}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition shadow-xs"
          >
            <ArrowSquareOut className="h-3.5 w-3.5 text-primary" />
            View Store
          </a>
        )}
      </div>

      {/* Stepper Navigation */}
      <nav aria-label="Settings progress" className="py-2">
        <ol className="flex items-center justify-between w-full">
          {STEPS.map((step, idx) => {
            const isActive = activeTab === step.id
            const isPast = idx < activeIndex

            return (
              <li key={step.id} className="relative flex-1 flex items-center">
                {/* Connecting line before step (except first) */}
                {idx > 0 && (
                  <div
                    className={`h-0.5 flex-1 transition-colors ${
                      isPast ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}

                {/* Step button */}
                <button
                  type="button"
                  onClick={() => setActiveTab(step.id)}
                  className="group flex flex-col sm:flex-row items-center gap-2 mx-2 cursor-pointer focus:outline-none"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-xs"
                        : isPast
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {isPast ? <Check className="h-4 w-4 stroke-[3]" /> : step.number}
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
                      isActive
                        ? "text-foreground font-bold"
                        : isPast
                        ? "text-foreground font-medium"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>

                {/* Connecting line after step (except last) */}
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 transition-colors ${
                      idx < activeIndex ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* ── Step 1: Shop Profile ── */}
      {activeTab === "profile" && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold">Shop Profile</CardTitle>
          </CardHeader>

          <form onSubmit={handleProfileSubmit}>
            <CardContent className="space-y-5">
              {/* Store Branding: Tall Hero Cover with Extra Large Centered Overlapping Logo */}
              <div className="relative mb-24 sm:mb-28">
                {/* Cover Banner */}
                <div className="relative h-60 sm:h-72 w-full rounded-2xl overflow-hidden border border-border bg-muted/30 group shadow-xs">
                  {seller?.banner ? (
                    <img
                      src={seller.banner}
                      alt={`${seller.name || "Shop"} Cover`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 text-muted-foreground">
                      <Camera className="h-10 w-10 text-muted-foreground/50 mb-2" />
                      <CompactUploader
                        isUploading={upload.isPending}
                        onUpload={async (file) => {
                          const url = await upload.mutateAsync(file)
                          updateProfile.mutate({ banner: url })
                        }}
                        triggerClassName="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold transition cursor-pointer shadow-xs"
                        triggerText="Add Cover Photo"
                      />
                    </div>
                  )}

                  {/* Banner action overlay when image exists */}
                  {seller?.banner && (
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <CompactUploader
                        isUploading={upload.isPending}
                        onUpload={async (file) => {
                          const url = await upload.mutateAsync(file)
                          updateProfile.mutate({ banner: url })
                        }}
                        triggerClassName="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 hover:bg-black/85 text-white backdrop-blur-xs text-xs font-semibold transition cursor-pointer shadow-xs"
                        triggerText="Change Cover"
                      />
                      <button
                        type="button"
                        onClick={() => updateProfile.mutate({ banner: null })}
                        disabled={upload.isPending}
                        className="p-1.5 rounded-lg bg-black/70 hover:bg-destructive text-white backdrop-blur-xs transition cursor-pointer shadow-xs"
                        title="Remove cover"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Extra Large Centered Overlapping Logo Avatar */}
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-22 sm:-bottom-24 z-10">
                  <div className="relative group">
                    <div className="h-44 w-44 sm:h-48 sm:w-48 rounded-full border-4 border-card bg-card shadow-2xl overflow-hidden flex items-center justify-center ring-2 ring-border/80">
                      {seller?.logo ? (
                        <img
                          src={seller.logo}
                          alt={`${seller.name || "Shop"} Logo`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/40 text-muted-foreground p-3">
                          <Camera className="h-12 w-12 text-muted-foreground/60 mb-1" />
                          <span className="text-xs font-semibold">Add Logo</span>
                        </div>
                      )}
                    </div>

                    {/* Logo edit overlay */}
                    <CompactUploader
                      isUploading={upload.isPending}
                      onUpload={async (file) => {
                        const url = await upload.mutateAsync(file)
                        updateProfile.mutate({ logo: url })
                      }}
                      triggerClassName="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold cursor-pointer backdrop-blur-2xs"
                      triggerText={seller?.logo ? "Change" : "Upload"}
                    />

                    {/* Logo remove button */}
                    {seller?.logo && (
                      <button
                        type="button"
                        onClick={() => updateProfile.mutate({ logo: null })}
                        disabled={upload.isPending}
                        className="absolute top-1.5 right-1.5 h-8 w-8 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg hover:scale-110 transition cursor-pointer ring-2 ring-card"
                        title="Remove logo"
                      >
                        <X className="h-4.5 w-4.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="shop-name">Shop Name</Label>
                  <Input
                    id="shop-name"
                    value={profileForm.name}
                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="e.g. Ama's Fresh Groceries"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="shop-handle">Shop Handle (URL slug)</Label>
                  <div className="flex rounded-md shadow-xs">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-muted/60 text-muted-foreground text-xs font-mono select-none">
                      alkemart.com/
                    </span>
                    <Input
                      id="shop-handle"
                      className="rounded-l-none"
                      value={profileForm.handle}
                      onChange={e => setProfileForm({
                        ...profileForm,
                        handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                      })}
                      placeholder="amas-groceries"
                      required
                    />
                  </div>
                </div>
              </div>

              <StatusRow mutation={updateProfile} successText="Profile saved" />
            </CardContent>

            <CardFooter className="flex items-center justify-between border-t border-border/60 pt-4">
              <span />
              <div className="flex items-center gap-2">
                <Button type="submit" isLoading={updateProfile.isPending} className="gap-2 px-5">
                  <FloppyDisk className="h-4 w-4" /> Save Profile
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setActiveTab("dispatch")}
                >
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* ── Step 2: Dispatch Address ── */}
      {activeTab === "dispatch" && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold">Dispatch Address</CardTitle>
            <p className="text-xs text-muted-foreground">Where should delivery couriers pick up your orders?</p>
          </CardHeader>

          <form onSubmit={handleAddressSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="address-1">Street / House / Area</Label>
                <Input
                  id="address-1"
                  value={addressForm.address_1}
                  onChange={e => setAddressForm({ ...addressForm, address_1: e.target.value })}
                  placeholder={GHANA_UI.addressPlaceholder}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address-2">Landmark <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="address-2"
                  value={addressForm.address_2}
                  onChange={e => setAddressForm({ ...addressForm, address_2: e.target.value })}
                  placeholder={GHANA_UI.landmarkPlaceholder}
                />
                <p className="text-[11px] text-muted-foreground">Riders navigate by landmarks — include one whenever possible.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="city">City / Town</Label>
                  <Input
                    id="city"
                    value={addressForm.city}
                    onChange={e => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder={GHANA_UI.cityPlaceholder}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={addressForm.province}
                    onValueChange={v => setAddressForm({ ...addressForm, province: v, district: "" })}
                  >
                    <SelectTrigger id="region">
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      {GHANA_REGIONS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="district">Municipal / District</Label>
                  <Select
                    value={addressForm.district}
                    onValueChange={v => setAddressForm({ ...addressForm, district: v })}
                    disabled={!addressForm.province}
                  >
                    <SelectTrigger id="district">
                      <SelectValue placeholder={addressForm.province ? "Select district" : "Pick region first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {districtsOf(addressForm.province).map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="postal-code">{GHANA_UI.postalLabel}</Label>
                  <Input
                    id="postal-code"
                    value={addressForm.postal_code}
                    onChange={e => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                    placeholder={GHANA_UI.postalExample}
                    maxLength={12}
                  />
                </div>
              </div>

              {/* GPS & Delivery fee row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label>Live Location</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 text-xs"
                    disabled={locating}
                    onClick={() => { void handleLiveLocation() }}
                  >
                    <NavigationArrow className={`h-3.5 w-3.5 ${locating ? "animate-spin" : ""}`} />
                    {locating ? "Locating…" : "Use My Location"}
                  </Button>
                  {addressForm.latitude != null && addressForm.longitude != null ? (
                    <p className="text-[11px] text-success font-medium">
                      Pinned at {addressForm.latitude.toFixed(4)}, {addressForm.longitude.toFixed(4)}
                    </p>
                  ) : locateError ? (
                    <p className="text-[11px] text-destructive font-medium">{locateError}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="delivery-fee">Delivery Fee <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none">
                      GH₵
                    </span>
                    <Input
                      id="delivery-fee"
                      type="number"
                      className="pl-12 text-sm"
                      value={addressForm.delivery_fee_ghs}
                      onChange={e => setAddressForm({ ...addressForm, delivery_fee_ghs: e.target.value })}
                      placeholder="15.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              <StatusRow mutation={updateAddress} successText="Delivery setup saved" />
            </CardContent>

            <CardFooter className="flex items-center justify-between border-t border-border/60 pt-4">
              <Button type="button" variant="ghost" className="gap-2" onClick={() => setActiveTab("profile")}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex items-center gap-2">
                <Button type="submit" isLoading={updateAddress.isPending} className="gap-2 px-5">
                  <FloppyDisk className="h-4 w-4" /> Save Setup
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={() => setActiveTab("momo")}>
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* ── Step 3: MoMo Payout ── */}
      {activeTab === "momo" && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold">Mobile Money Payout</CardTitle>
            <p className="text-xs text-muted-foreground">Where should Alkemart send your earnings?</p>
          </CardHeader>

          <form onSubmit={handlePaymentSubmit}>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="momo-phone">MoMo Number</Label>
                <div className="relative max-w-sm">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none pointer-events-none">
                    +233
                  </span>
                  <Input
                    id="momo-phone"
                    type="tel"
                    className="pl-12 pr-10"
                    value={phoneRaw}
                    onChange={e => setPhoneRaw(e.target.value)}
                    onBlur={() => setPhoneTouched(true)}
                    placeholder={GHANA_UI.phoneExample}
                    required
                    maxLength={17}
                    inputMode="tel"
                  />
                  {phoneTouched && phoneRaw && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {phoneValid ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <WarningCircle className="h-4 w-4 text-destructive" />
                      )}
                    </span>
                  )}
                </div>

                {phoneError && (
                  <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                    <WarningCircle className="h-3.5 w-3.5 shrink-0" /> {phoneError}
                  </p>
                )}

                {phoneValid && (
                  <p className="text-xs text-success font-semibold flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    {formatPhoneDisplay(phoneRaw)}
                    {detectedProvider && ` — ${MOMO_NETWORKS[detectedProvider].label}`}
                  </p>
                )}
              </div>

              {/* Compact Network Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DeviceMobile className="h-4 w-4" />
                  Network
                  {detectedProvider && (
                    <span className="ml-auto text-[11px] font-normal text-muted-foreground">
                      Auto-detected
                    </span>
                  )}
                </Label>

                <div className="grid grid-cols-3 gap-3">
                  {(Object.entries(MOMO_NETWORKS) as [MomoProvider, (typeof MOMO_NETWORKS)[MomoProvider]][]).map(([key, net]) => {
                    const active = provider === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setProvider(key)}
                        aria-pressed={active}
                        aria-label={net.label}
                        className={`group relative h-20 sm:h-24 w-full rounded-xl border-2 p-3 flex items-center justify-center bg-white dark:bg-zinc-900 transition-all cursor-pointer shadow-xs ${
                          active
                            ? "border-emerald-600 ring-2 ring-emerald-600/30"
                            : "border-border hover:border-muted-foreground/40 hover:bg-muted/10"
                        }`}
                      >
                        {active && (
                          <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs z-10">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </span>
                        )}
                        <img
                          src={net.logo}
                          alt={net.short}
                          className="h-12 sm:h-14 w-auto max-w-full object-contain transition-transform group-hover:scale-105"
                        />
                      </button>
                    )
                  })}
                </div>
              </div>

              <StatusRow mutation={updatePayment} successText="Payout details saved" />
            </CardContent>

            <CardFooter className="flex items-center justify-between border-t border-border/60 pt-4">
              <Button type="button" variant="ghost" className="gap-2" onClick={() => setActiveTab("dispatch")}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                type="submit"
                isLoading={updatePayment.isPending}
                disabled={phoneTouched && !phoneValid}
                className="gap-2 px-6"
              >
                <FloppyDisk className="h-4 w-4" /> Save Payout Details
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
      {activeTab === "alerts" && (
        <AlertsCard />
      )}
    </PageShell>
  )
}

const ALERT_TOPIC_COPY: Record<string, { label: string; hint: string }> = {
  stock: { label: "Low stock", hint: "Combinations running at 5 or fewer units." },
  price: { label: "Stale prices", hint: "Published prices unverified for 72h+." },
  sla: { label: "Order delays", hint: "Placed orders waiting over a day." },
  order: { label: "Order events", hint: "Dispatch reminders and payout failures." },
  payout: { label: "Payout failures", hint: "Failed transfers that need support." },
}

/**
 * Alert topics (Phase 7C): which journey tasks appear on the dashboard.
 * Everything is on by default; switching a topic off hides its tasks.
 */
function AlertsCard() {
  const { data, isLoading, isError } = useAlertPrefs()
  const setPref = useSetAlertPref()
  const topics = data?.topics ?? []
  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-bold">Alert topics</CardTitle>
        <p className="text-xs text-muted-foreground">
          Choose which jobs appear on your dashboard. Order SMS to buyers is unaffected.
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading ? (
          <Skeleton className="h-12 w-full rounded-xl" />
        ) : isError ? (
          <p className="text-sm text-destructive">Could not load alert settings.</p>
        ) : (
          topics.map((t) => {
            const copy = ALERT_TOPIC_COPY[t.topic] ?? { label: t.topic, hint: "" }
            return (
              <label key={t.topic} className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/50">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={t.optedIn}
                  disabled={setPref.isPending}
                  onChange={(e) => setPref.mutate({ topic: t.topic, optedIn: e.target.checked })}
                />
                <span>
                  <span className="block text-sm font-bold">{copy.label}</span>
                  {copy.hint ? (
                    <span className="block text-xs text-muted-foreground">{copy.hint}</span>
                  ) : null}
                </span>
              </label>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Compact Uploader Trigger
// ---------------------------------------------------------------------------
function CompactUploader({
  isUploading,
  onUpload,
  triggerText,
  triggerClassName,
}: {
  isUploading: boolean
  onUpload: (file: File) => Promise<void>
  triggerText: string
  triggerClassName?: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const okTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"]
    if (!okTypes.includes(file.type)) {
      setError("PNG, JPG, WebP only")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("< 5MB only")
      return
    }
    try {
      await onUpload(file)
    } catch (err) {
      setError("Upload failed")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={isUploading}
        className="sr-only"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className={
          triggerClassName ||
          "inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs text-[11px] font-semibold transition cursor-pointer shadow-xs"
        }
      >
        <Camera className="h-3 w-3" />
        {isUploading ? "Uploading…" : triggerText}
      </button>
      {error && (
        <span className="text-[10px] text-destructive font-semibold ml-1">{error}</span>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Shared Status Row
// ---------------------------------------------------------------------------
function StatusRow({
  mutation,
  successText,
}: {
  mutation: { isPending?: boolean; isSuccess: boolean; isError: boolean; error?: unknown }
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
    const t = setTimeout(() => setVisible(null), 5000)
    return () => clearTimeout(t)
  }, [visible])

  if (!visible) return null
  if (visible === "success") {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/10 text-success text-xs font-semibold border border-success/20" role="status">
        <CheckCircle className="h-3.5 w-3.5 shrink-0" /> {successText}
      </div>
    )
  }
  const detail = mutation.error instanceof Error && mutation.error.message ? mutation.error.message : null
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20" role="alert">
      <WarningCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold">Could not save — please try again</p>
        {detail ? <p className="mt-0.5 text-destructive/80">{detail}</p> : null}
      </div>
    </div>
  )
}
