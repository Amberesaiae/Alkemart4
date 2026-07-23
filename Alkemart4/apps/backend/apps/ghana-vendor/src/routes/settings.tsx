import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { useSellerProfile, useUpdateProfile, useUpdateAddress, useUpdatePayment } from "../lib/hooks"
import { Card, Button, Input, Label, Select } from "../components/ui"
import { Store, MapPin, CreditCard, Save } from "lucide-react"

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
  const [addressForm, setAddressForm] = useState({ address_1: "", city: "", country_code: "gh" })
  const [paymentForm, setPaymentForm] = useState({ type: "momo", phone: "", provider: "mtn" })

  useEffect(() => {
    if (seller) {
      setProfileForm({ 
        name: seller.name || "", 
        handle: seller.handle || "" 
      })
      if (seller.address) {
        setAddressForm({
          address_1: seller.address.address_1 || "",
          city: seller.address.city || "",
          country_code: seller.address.country_code || "gh"
        })
      }
      if (seller.payment_details) {
        setPaymentForm({
          type: "momo",
          phone: seller.payment_details.phone || "",
          provider: seller.payment_details.provider || "mtn"
        })
      }
    }
  }, [seller])

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfile.mutate(profileForm)
  }

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (seller) {
      updateAddress.mutate({ id: seller.id, data: addressForm })
    }
  }

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (seller) {
      updatePayment.mutate({ id: seller.id, data: paymentForm })
    }
  }

  if (isLoading) {
    return <div className="animate-pulse h-96 bg-muted rounded-xl"></div>
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Shop Settings</h1>
        <p className="text-muted-foreground font-medium">Configure your store details and payouts.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-2 overflow-x-auto pb-2 scrollbar-none">
          <Button 
            variant={activeTab === "profile" ? "default" : "ghost"} 
            className={`justify-start gap-3 w-full border-none shadow-none ${activeTab !== "profile" ? "text-muted-foreground" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <Store className="h-5 w-5" />
            Shop Profile
          </Button>
          <Button 
            variant={activeTab === "dispatch" ? "default" : "ghost"} 
            className={`justify-start gap-3 w-full border-none shadow-none ${activeTab !== "dispatch" ? "text-muted-foreground" : ""}`}
            onClick={() => setActiveTab("dispatch")}
          >
            <MapPin className="h-5 w-5" />
            Dispatch Address
          </Button>
          <Button 
            variant={activeTab === "momo" ? "default" : "ghost"} 
            className={`justify-start gap-3 w-full border-none shadow-none ${activeTab !== "momo" ? "text-muted-foreground" : ""}`}
            onClick={() => setActiveTab("momo")}
          >
            <CreditCard className="h-5 w-5" />
            MoMo Payout
          </Button>
        </div>

        <div className="flex-1 w-full">
          {activeTab === "profile" && (
            <Card className="p-6 border-2 shadow-sm">
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <h2 className="text-xl font-bold tracking-tight mb-6">Shop Profile</h2>
                <div className="space-y-2">
                  <Label>Shop Name</Label>
                  <Input 
                    value={profileForm.name} 
                    onChange={e => setProfileForm({...profileForm, name: e.target.value})} 
                    placeholder="e.g. Ama's Fresh Groceries"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shop Handle (URL)</Label>
                  <div className="flex relative">
                    <span className="inline-flex items-center px-4 rounded-l-md border-2 border-r-0 border-border bg-muted text-muted-foreground font-medium text-sm">
                      alkemart.com/
                    </span>
                    <Input 
                      className="rounded-l-none"
                      value={profileForm.handle} 
                      onChange={e => setProfileForm({...profileForm, handle: e.target.value})} 
                      placeholder="amas-groceries"
                    />
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit" isLoading={updateProfile.isPending} className="gap-2 px-8">
                    <Save className="h-4 w-4" /> Save Profile
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === "dispatch" && (
            <Card className="p-6 border-2 shadow-sm">
              <form onSubmit={handleAddressSubmit} className="space-y-6">
                <h2 className="text-xl font-bold tracking-tight mb-6">Dispatch Address</h2>
                <p className="text-muted-foreground text-sm font-medium mb-6">Where should delivery riders pick up your orders?</p>
                <div className="space-y-2">
                  <Label>Street Address / Landmark</Label>
                  <Input 
                    value={addressForm.address_1} 
                    onChange={e => setAddressForm({...addressForm, address_1: e.target.value})} 
                    placeholder="e.g. Makola Market, Block C, Stall 45"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input 
                      value={addressForm.city} 
                      onChange={e => setAddressForm({...addressForm, city: e.target.value})} 
                      placeholder="Accra"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select disabled value="gh">
                      <option value="gh">Ghana</option>
                    </Select>
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit" isLoading={updateAddress.isPending} className="gap-2 px-8">
                    <Save className="h-4 w-4" /> Save Address
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {activeTab === "momo" && (
            <Card className="p-6 border-2 shadow-sm">
              <form onSubmit={handlePaymentSubmit} className="space-y-6">
                <h2 className="text-xl font-bold tracking-tight mb-6">Mobile Money Payout</h2>
                <p className="text-muted-foreground text-sm font-medium mb-6">How do you want to receive your earnings?</p>
                
                <div className="space-y-2">
                  <Label>Network Provider</Label>
                  <Select 
                    value={paymentForm.provider} 
                    onChange={e => setPaymentForm({...paymentForm, provider: e.target.value})}
                  >
                    <option value="mtn">MTN Mobile Money</option>
                    <option value="vodafone">Telecel (Vodafone) Cash</option>
                    <option value="airteltigo">AT (AirtelTigo) Money</option>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>MoMo Number</Label>
                  <Input 
                    type="tel"
                    value={paymentForm.phone} 
                    onChange={e => setPaymentForm({...paymentForm, phone: e.target.value})} 
                    placeholder="024 123 4567"
                    required
                  />
                </div>
                
                <div className="pt-4 flex justify-end">
                  <Button type="submit" isLoading={updatePayment.isPending} className="gap-2 px-8">
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