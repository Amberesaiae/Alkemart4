import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { useSellerProfile, useUpdateProfile, useUpdateAddress, useUpdatePayment } from "../lib/hooks"
import { Card, Button, Input, Label, Select } from "../components/ui"
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
import { Store, MapPin, CreditCard, Save, CheckCircle2, AlertCircle, Smartphone } from "lucide-react"

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { data, isLoading } = useSellerProfile()
  const seller = data?.seller
  const updateProfile  = useUpdateProfile()
  const updateAddress  = useUpdateAddress()
  const updatePayment  = useUpdatePayment()

  const [activeTab, setActiveTab] = useState<"profile" | "dispatch" | "momo">("profile")

  const [profileForm, setProfileForm] = useState({ name: "", handle: "" })
  const [addressForm, setAddressForm] = useState({
    address_1: "",
    address_2: "",   // landmark — mirrors operating-markets address_2 field
    city: "",
    province: "",    // region — mirrors operating-markets province field
    postal_code: "", // GhanaPostGPS (optional)
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
      const a = seller.address as any
      setAddressForm({
        address_1:   a.address_1   || "",
        address_2:   a.address_2   || "",
        city:        a.city        || "",
        province:    a.province    || "",
        postal_code: a.postal_code || "",
        country_code: "gh",
      })
    }
    if (seller.payment_details) {
      const pd = seller.payment_details as any
      setPhoneRaw(pd.phone || "")
      setProvider((pd.provider as MomoProvider) || "mtn")
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
    if (seller) updateAddress.mutate({ id: seller.id, data: addressForm })
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

  if (isLoading) return <div className="animate-pulse h-96 bg-muted rounded-xl" />

  const tabs = [
    { id: "profile"  as const, label: "Shop Profile",    icon: Store },
    { id: "dispatch" as const, label: "Dispatch Address", icon: MapPin },
    { id: "momo"     as const, label: "MoMo Payout",     icon: CreditCard },
  ]

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Shop Settings</h1>
        <p className="text-muted-foreground font-medium">Configure your store details and payouts.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">

        {/* Tab nav */}
        <div className="w-full md:w-56 shrink-0 flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all w-full text-left whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 w-full min-w-0">

          {/* ── Shop Profile ── */}
          {activeTab === "profile" && (
            <Card className="p-6 border-2 shadow-sm">
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
            <Card className="p-6 border-2 shadow-sm">
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

                <StatusRow mutation={updateAddress} successText="Address saved" />

                <div className="flex justify-end pt-2">
                  <Button type="submit" isLoading={updateAddress.isPending} className="gap-2 px-8">
                    <Save className="h-4 w-4" /> Save Address
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* ── MoMo Payout ── */}
          {activeTab === "momo" && (
            <Card className="p-6 border-2 shadow-sm">
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
                          ? <CheckCircle2 className="h-5 w-5 text-green-600" />
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
                    <p className="text-xs text-green-700 font-semibold flex items-center gap-1">
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
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 text-yellow-900 text-xs font-semibold border border-yellow-200">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-yellow-600" />
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
  mutation: { isSuccess: boolean; isError: boolean }
  successText: string
}) {
  if (!mutation.isSuccess && !mutation.isError) return null
  if (mutation.isSuccess) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm font-semibold border border-green-200">
        <CheckCircle2 className="h-4 w-4 shrink-0" /> {successText}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20">
      <AlertCircle className="h-4 w-4 shrink-0" /> Could not save — try again
    </div>
  )
}
