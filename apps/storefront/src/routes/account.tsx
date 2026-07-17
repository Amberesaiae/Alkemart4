import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/skeleton"
import { FormField, FormSelect } from "@/components/form-field"
import {
  getSessionCustomer,
  logout,
  updateCustomerProfile,
} from "@/lib/auth"
import {
  createMyAddress,
  deleteMyAddress,
  listMyAddresses,
  setDefaultShippingAddress,
  type AddressInput,
} from "@/lib/addresses"
import { listRegionCountryCodes } from "@/lib/region"
import { useState } from "react"

export const Route = createFileRoute("/account")({
  component: AccountPage,
})

function AccountPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const sessionQ = useQuery({
    queryKey: ["store", "session"],
    queryFn: () => getSessionCustomer(),
  })

  const addressesQ = useQuery({
    queryKey: ["store", "addresses"],
    queryFn: () => listMyAddresses(),
    enabled: Boolean(sessionQ.data),
  })

  const countriesQ = useQuery({
    queryKey: ["store", "region-countries"],
    queryFn: () => listRegionCountryCodes(),
    enabled: Boolean(sessionQ.data),
  })

  const [showForm, setShowForm] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const [profileFirst, setProfileFirst] = useState("")
  const [profileLast, setProfileLast] = useState("")
  const [profilePhone, setProfilePhone] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [line1, setLine1] = useState("")
  const [city, setCity] = useState("")
  const [province, setProvince] = useState("")
  const [country, setCountry] = useState("")
  const [postal, setPostal] = useState("")

  const countries = countriesQ.data ?? []
  const countryCode = country || countries[0] || ""

  const createAddr = useMutation({
    mutationFn: () => {
      if (!countryCode) {
        throw new Error("Country required from region configuration")
      }
      const body: AddressInput = {
        first_name: firstName,
        last_name: lastName,
        phone,
        address_1: line1,
        city,
        province: province || undefined,
        country_code: countryCode,
        postal_code: postal || undefined,
      }
      return createMyAddress(body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store", "addresses"] })
      setShowForm(false)
      setFirstName("")
      setLastName("")
      setPhone("")
      setLine1("")
      setCity("")
      setProvince("")
      setPostal("")
    },
  })

  const removeAddr = useMutation({
    mutationFn: (id: string) => deleteMyAddress(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store", "addresses"] })
    },
  })

  const setDefault = useMutation({
    mutationFn: (id: string) => setDefaultShippingAddress(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store", "addresses"] })
    },
  })

  const signOut = useMutation({
    mutationFn: () => logout(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store"] })
      void navigate({ to: "/signin", search: {} })
    },
  })

  const saveProfile = useMutation({
    mutationFn: () =>
      updateCustomerProfile({
        firstName: profileFirst,
        lastName: profileLast,
        phone: profilePhone,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store", "session"] })
      setEditProfile(false)
    },
  })

  if (sessionQ.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3" role="status" aria-label="Loading account">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    )
  }

  if (!sessionQ.data) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="Sign in required"
          description="Manage your profile and saved addresses after you sign in."
          actionLabel="Sign in"
          actionTo="/signin"
          actionSearch={{ redirect: "/account" }}
        />
      </div>
    )
  }

  const user = sessionQ.data
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
  const initial = (displayName.slice(0, 1) || "?").toUpperCase()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="overflow-hidden rounded-3xl border border-border bg-[linear-gradient(135deg,#1a1a1a_0%,#2a2a2a_100%)] p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Account
            </p>
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {displayName}
            </h1>
            <p className="truncate text-sm text-white/65">{user.email}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            className="rounded-none bg-primary text-primary-foreground"
          >
            <Link to="/orders">Your orders</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-none border-white/25 bg-transparent text-white hover:bg-white/10"
            onClick={() => {
              setProfileFirst(user.firstName ?? "")
              setProfileLast(user.lastName ?? "")
              setProfilePhone("")
              setEditProfile((v) => !v)
            }}
          >
            {editProfile ? "Cancel edit" : "Edit profile"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-none border-white/25 bg-transparent text-white hover:bg-white/10"
            disabled={signOut.isPending}
            onClick={() => signOut.mutate()}
          >
            Sign out
          </Button>
        </div>
      </header>

      {editProfile ? (
        <section className="space-y-3 border border-border bg-card p-5">
          <h2 className="text-base font-bold">Profile</h2>
          <p className="text-xs text-muted-foreground">
            Updates go to the Medusa customer record. Email is not changed here.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="First name"
              value={profileFirst}
              onChange={setProfileFirst}
            />
            <FormField
              label="Last name"
              value={profileLast}
              onChange={setProfileLast}
            />
          </div>
          <FormField
            label="Phone (optional)"
            value={profilePhone}
            onChange={setProfilePhone}
            type="tel"
          />
          {saveProfile.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {saveProfile.error instanceof Error
                ? saveProfile.error.message
                : "Could not update profile"}
            </p>
          ) : null}
          {saveProfile.isSuccess ? (
            <p className="text-sm font-medium" aria-live="polite">
              Profile saved.
            </p>
          ) : null}
          <Button
            type="button"
            className="min-h-11 w-full rounded-none"
            disabled={saveProfile.isPending}
            onClick={() => saveProfile.mutate()}
          >
            {saveProfile.isPending ? "Saving…" : "Save profile"}
          </Button>
        </section>
      ) : null}

      <section className="space-y-4 border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Saved addresses</h2>
            <p className="text-xs text-muted-foreground">
              Used for faster COD checkout
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancel" : "Add address"}
          </Button>
        </div>

        {addressesQ.isLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : null}

        {addressesQ.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {addressesQ.error instanceof Error
              ? addressesQ.error.message
              : "Could not load addresses"}
          </p>
        ) : null}

        {addressesQ.data && addressesQ.data.length === 0 && !showForm ? (
          <p className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            No saved addresses yet. Add one for faster checkout.
          </p>
        ) : null}

        <ul className="space-y-3">
          {addressesQ.data?.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-background p-4 text-sm"
            >
              <div className="space-y-1">
                <p className="font-semibold">
                  {[a.firstName, a.lastName].filter(Boolean).join(" ")}
                  {a.isDefaultShipping ? (
                    <span className="ml-2 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground">
                      default
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground">
                  {[a.address1, a.city, a.province, a.countryCode?.toUpperCase()]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {a.phone ? (
                  <p className="text-xs text-muted-foreground">{a.phone}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1">
                {!a.isDefaultShipping ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={setDefault.isPending}
                    onClick={() => setDefault.mutate(a.id)}
                  >
                    Set default
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={removeAddr.isPending}
                  onClick={() => removeAddr.mutate(a.id)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {showForm ? (
          <form
            className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4"
            onSubmit={(e) => {
              e.preventDefault()
              createAddr.mutate()
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <FormField
                label="First name"
                value={firstName}
                onChange={setFirstName}
                required
              />
              <FormField
                label="Last name"
                value={lastName}
                onChange={setLastName}
                required
              />
            </div>
            <FormField
              label="Phone"
              value={phone}
              onChange={setPhone}
              type="tel"
              required
            />
            <FormField
              label="Address"
              value={line1}
              onChange={setLine1}
              required
            />
            <FormField label="City" value={city} onChange={setCity} required />
            <FormField
              label="Region"
              value={province}
              onChange={setProvince}
            />
            <FormSelect
              label="Country"
              value={countryCode}
              onChange={setCountry}
              required
            >
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </FormSelect>
            <FormField
              label="Postal (optional)"
              value={postal}
              onChange={setPostal}
            />
            {createAddr.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {createAddr.error instanceof Error
                  ? createAddr.error.message
                  : "Could not save address"}
              </p>
            ) : null}
            <Button
              type="submit"
              className="min-h-11 w-full rounded-xl"
              disabled={createAddr.isPending}
            >
              {createAddr.isPending ? "Saving…" : "Save address"}
            </Button>
          </form>
        ) : null}
      </section>
    </div>
  )
}
