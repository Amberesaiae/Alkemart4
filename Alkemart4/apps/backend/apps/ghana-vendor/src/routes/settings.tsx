import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { useSellerProfile, useUpdateProfile, useUpdateAddress, useUpdatePayment } from "../lib/hooks"
import { Card, Button, Input, Label, Select } from "../components/ui"
import {
  GHANA_REGIONS,
  MOMO_NETWORKS,
  type MoMoNetwork,
  detectNetwork,
  validateGhanaPhone,
  formatGhanaPhone,
  networkPrefixHint,
  normalisePhone,
} from "../lib/ghana"
import { Store, MapPin, CreditCard, Save, CheckCircle2, AlertCircle, Smartphone } from "lucide-react"

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { data, isLoading } = useSellerProfile()
  const seller = data?.seller
  const updateProfile = useUpdateProfile()
  const updateAddress = useUpdateAddress()
  const updatePayment = useUpdatePayment()

  const [activeTab, setActiveTab] = useState<"profile" | "dispatch" | "momo">("profile")

  const [profileForm, setProfileForm] = useState({ name: "", handle: "" })
  const [addressForm, setAddressForm] = useState({
    address_1: "",
    city: "",
    region: "",
    country_code: "gh",
  })
  const [paymentForm, setPaymentForm] = useState({
    type: "momo",
    phone: "",
    provider: "mtn" as MoMoNetwork,
  })

  // Live phone validation state
  const [phoneRaw, setPhoneRaw] = useState("")
  const [phoneTouched, setPhoneTouched] = useState(false)
  const detectedNetwork = detectNetwork(phoneRaw)
  const phoneValidation = phoneTouched ? validateGhanaPhone(phoneRaw) : null

  useEffect(() => {
    if (seller) {
      setProfileForm({ name: seller.name || "", handle: seller.handle || "" })
      if (seller.address) {
        setAddressForm({
          address_1: seller.address.address_1 || "",
          city: seller.address.city || "",
          region: (seller.address as any).region || "",
          country_code: "gh",
        })
      }
      if (seller.payment_details) {
        const phone = seller.payment_details.phone || ""
        setPhoneRaw(phone)
        setPaymentForm({
          type: "momo",
          phone,
          provider: (seller.payment_details.provider as MoMoNetwork) || "mtn",
        })
      }
    }
  }, [seller])

  // Auto-detect provider from phone number prefix
  useEffect(() => {
    if (detectedNetwork) {
      setPaymentForm(f => ({ ...f, provider: detectedNetwork }))
    }
  }, [detectedNetwork])

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
    const validation = validateGhanaPhone(phoneRaw)
    if (!validation.valid) { setPhoneTouched(true); return }
    if (seller) {
      updatePayment.mutate({
        id: seller.id,
        data: { ...paymentForm, phone: normalisePhone(phoneRaw) },
      })
    }
  }

  if (isLoading) {
    return <div className="animate-pulse h-96 bg-muted rounded-xl" />
  }

  const tabs = [
    { id: "profile" as const, label: "Shop Profile", icon: Store },
    { id: "dispatch" as const, label: "Dispatch Address", icon: MapPin },
    { id: "momo" as const, label: "MoMo Payout", icon: CreditCard },
  ]

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Shop Settings</h1>
        <p className="text-muted-foreground font-medium">Configure your store details and payouts.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Sidebar nav */}
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

        {/* Panels */}
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
                      onChange={e => setProfileForm({ ...profileForm, handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                      placeholder="amas-groceries"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only</p>
                </div>

                {updateProfile.isSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm font-semibold border border-green-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> Profile saved
                  </div>
                )}
                {updateProfile.isError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20">
                    <AlertCircle className="h-4 w-4 shrink-0" /> Could not save — try again
                  </div>
                )}

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

                <div className="space-y-2">
                  <Label>Street Address / Landmark</Label>
                  <Input
                    value={addressForm.address_1}
                    onChange={e => setAddressForm({ ...addressForm, address_1: e.target.value })}
                    placeholder="e.g. Makola Market, Block C, Stall 45"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Include a recognisable landmark — riders navigate by landmarks, not street names
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City / Town</Label>
                    <Input
                      value={addressForm.city}
                      onChange={e => setAddressForm({ ...addressForm, city: e.target.value })}
                      placeholder="Accra"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Region</Label>
                    <Select
                      value={addressForm.region}
                      onChange={e => setAddressForm({ ...addressForm, region: e.target.value })}
                      required
                    >
                      <option value="" disabled>Select region</option>
                      {GHANA_REGIONS.map(r => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Region capital hint */}
                {addressForm.region && (
                  <p className="text-xs text-muted-foreground -mt-2">
                    Regional capital:{" "}
                    <span className="font-semibold text-foreground">
                      {GHANA_REGIONS.find(r => r.value === addressForm.region)?.capital}
                    </span>
                  </p>
                )}

                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select disabled value="gh">
                    <option value="gh">Ghana</option>
                  </Select>
                </div>

                {updateAddress.isSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm font-semibold border border-green-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> Address saved
                  </div>
                )}
                {updateAddress.isError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20">
                    <AlertCircle className="h-4 w-4 shrink-0" /> Could not save — try again
                  </div>
                )}

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

                {/* Phone number — primary field, drives auto-detection */}
                <div className="space-y-2">
                  <Label>MoMo Number</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground select-none">
                      +233
                    </span>
                    <Input
                      type="tel"
                      className="pl-14"
                      value={phoneRaw}
                      onChange={e => {
                        setPhoneRaw(e.target.value)
                        setPaymentForm(f => ({ ...f, phone: e.target.value }))
                      }}
                      onBlur={() => setPhoneTouched(true)}
                      placeholder="024 123 4567"
                      required
                      maxLength={13}
                    />
                    {/* Validated indicator */}
                    {phoneTouched && phoneRaw && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {validateGhanaPhone(phoneRaw).valid
                          ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                          : <AlertCircle className="h-5 w-5 text-destructive" />
                        }
                      </span>
                    )}
                  </div>

                  {/* Validation message */}
                  {phoneValidation && !phoneValidation.valid && (
                    <p className="text-xs text-destructive font-semibold flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {phoneValidation.message}
                    </p>
                  )}

                  {/* Formatted preview + auto-detected network */}
                  {phoneRaw && validateGhanaPhone(phoneRaw).valid && (
                    <p className="text-xs text-green-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {formatGhanaPhone(phoneRaw)}
                      {detectedNetwork && ` — ${MOMO_NETWORKS[detectedNetwork].label}`}
                    </p>
                  )}
                </div>

                {/* Network selector — auto-set from prefix but overrideable */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Network Provider
                    {detectedNetwork && (
                      <span className="ml-auto text-xs font-normal text-muted-foreground">
                        Auto-detected from your number
                      </span>
                    )}
                  </Label>

                  {/* Network cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(Object.entries(MOMO_NETWORKS) as [MoMoNetwork, typeof MOMO_NETWORKS[MoMoNetwork]][]).map(([key, net]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPaymentForm(f => ({ ...f, provider: key }))}
                        className={`relative flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${
                          paymentForm.provider === key
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        {paymentForm.provider === key && (
                          <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-primary" />
                        )}
                        <span className="font-black text-sm">{net.label}</span>
                        <span className="text-xs text-muted-foreground mt-1">
                          {networkPrefixHint(key)}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Mismatch warning */}
                  {detectedNetwork && detectedNetwork !== paymentForm.provider && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 text-yellow-800 text-xs font-semibold border border-yellow-200">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      Your number prefix matches <strong>{MOMO_NETWORKS[detectedNetwork].label}</strong>,
                      but you selected {MOMO_NETWORKS[paymentForm.provider].label}.
                      Make sure this is correct before saving.
                    </div>
                  )}
                </div>

                {updatePayment.isSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 text-sm font-semibold border border-green-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> Payout details saved
                  </div>
                )}
                {updatePayment.isError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-semibold border border-destructive/20">
                    <AlertCircle className="h-4 w-4 shrink-0" /> Could not save — try again
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    isLoading={updatePayment.isPending}
                    disabled={phoneTouched && !validateGhanaPhone(phoneRaw).valid}
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
