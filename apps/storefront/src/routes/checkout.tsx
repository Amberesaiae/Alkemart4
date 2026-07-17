import { useEffect, useRef, useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Price } from "@/components/price"
import {
  trackCheckoutStarted,
  trackOrderCompleted,
} from "@/lib/analytics"
import {
  formatMoney,
  getLocalCartId,
  groupCartBySeller,
  retrieveCart,
} from "@/lib/cart"
import {
  listShippingOptionsForCart,
  placeGhanaOrder,
  type CheckoutAddress,
  type MomoProvider,
} from "@/lib/checkout"
import { SellerChip } from "@/components/seller-chip"
import { listRegionCountryCodes } from "@/lib/region"
import { getSessionCustomer } from "@/lib/auth"
import { listMyAddresses, type CustomerAddress } from "@/lib/addresses"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/skeleton"
import { FormField, FormSelect } from "@/components/form-field"
import { cn } from "@/lib/utils"
import { isMomoLabEnabled } from "@/lib/env"

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
})

function applyAddress(
  a: CustomerAddress,
  setters: {
    setFirstName: (v: string) => void
    setLastName: (v: string) => void
    setPhone: (v: string) => void
    setLine1: (v: string) => void
    setCity: (v: string) => void
    setProvince: (v: string) => void
    setCountry: (v: string) => void
    setPostal: (v: string) => void
  },
) {
  setters.setFirstName(a.firstName ?? "")
  setters.setLastName(a.lastName ?? "")
  setters.setPhone(a.phone ?? "")
  setters.setLine1(a.address1 ?? "")
  setters.setCity(a.city ?? "")
  setters.setProvince(a.province ?? "")
  setters.setCountry((a.countryCode ?? "").toLowerCase())
  setters.setPostal(a.postalCode ?? "")
}

function CheckoutPage() {
  const navigate = useNavigate()
  const checkoutStartedSent = useRef(false)
  const cartQ = useQuery({
    queryKey: ["store", "cart"],
    queryFn: () => retrieveCart(),
  })
  const countriesQ = useQuery({
    queryKey: ["store", "region-countries"],
    queryFn: () => listRegionCountryCodes(),
  })
  const sessionQ = useQuery({
    queryKey: ["store", "session"],
    queryFn: () => getSessionCustomer(),
  })
  const addressesQ = useQuery({
    queryKey: ["store", "addresses"],
    queryFn: () => listMyAddresses(),
    enabled: Boolean(sessionQ.data),
  })
  const shippingQ = useQuery({
    queryKey: ["store", "shipping-options", cartQ.data?.id],
    queryFn: () =>
      listShippingOptionsForCart(
        cartQ.data?.id ?? getLocalCartId() ?? undefined,
      ),
    enabled: Boolean(cartQ.data?.items.length),
  })

  const countries = countriesQ.data ?? []
  const defaultCountry = countries[0] ?? ""
  const saved = addressesQ.data ?? []

  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">(
    "new",
  )
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [line1, setLine1] = useState("")
  const [landmark, setLandmark] = useState("")
  const [city, setCity] = useState("")
  const [province, setProvince] = useState("")
  const [country, setCountry] = useState("")
  const [postal, setPostal] = useState("")
  const momoLab = isMomoLabEnabled()
  const [payMethod, setPayMethod] = useState<"cod" | "momo">("cod")
  const [momoProvider, setMomoProvider] = useState<MomoProvider>("mtn")

  const setters = {
    setFirstName,
    setLastName,
    setPhone,
    setLine1,
    setCity,
    setProvince,
    setCountry,
    setPostal,
  }

  useEffect(() => {
    if (!saved.length || selectedAddressId !== "new") return
    const def = saved.find((a) => a.isDefaultShipping) ?? saved[0]
    if (def) {
      setSelectedAddressId(def.id)
      applyAddress(def, setters)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.length])

  const effectiveEmail = email.trim() || sessionQ.data?.email?.trim() || ""
  const countryCode = country || defaultCountry

  useEffect(() => {
    const cart = cartQ.data
    if (!cart?.items.length || checkoutStartedSent.current) return
    checkoutStartedSent.current = true
    trackCheckoutStarted({
      itemCount: cart.items.length,
      cartTotal: cart.total,
      currency: cart.currencyCode,
    })
  }, [cartQ.data])

  const place = useMutation({
    mutationFn: async () => {
      if (!countryCode) {
        throw new Error(
          "No country on region — configure region countries in Admin",
        )
      }
      if (payMethod === "momo" && !momoLab) {
        throw new Error("Mobile Money is not enabled for this storefront")
      }
      const address: CheckoutAddress = {
        first_name: firstName,
        last_name: lastName,
        phone,
        address_1: line1,
        address_2: landmark || undefined,
        city,
        province: province || undefined,
        country_code: countryCode,
        postal_code: postal || undefined,
      }
      return placeGhanaOrder({
        address,
        email: effectiveEmail,
        paymentMethod: payMethod,
        momoProvider: payMethod === "momo" ? momoProvider : undefined,
      })
    },
    onSuccess: (result) => {
      const cart = cartQ.data
      if (result.status === "payment_pending") {
        void navigate({
          to: "/checkout/pending",
          search: {
            cart_id: result.cart_id,
            ref: result.client_reference ?? result.provider_reference ?? "",
          },
        })
        return
      }
      trackOrderCompleted({
        orderId: result.order_id,
        paymentMethod: payMethod,
        itemCount: cart?.items.length,
        total: cart?.total ?? null,
        currency: cart?.currencyCode ?? null,
      })
      void navigate({
        to: "/order/$id",
        params: { id: result.order_id },
        search: { placed: "1", pay: payMethod },
      })
    },
  })

  const items = cartQ.data?.items ?? []
  const sellerGroups = groupCartBySeller(items)
  const multiSeller =
    sellerGroups.filter((g) => g.seller?.name).length > 1 ||
    (sellerGroups.length > 1 && sellerGroups.some((g) => g.seller?.name))
  const canSubmit =
    items.length > 0 &&
    effectiveEmail &&
    firstName.trim() &&
    lastName.trim() &&
    phone.trim() &&
    line1.trim() &&
    city.trim() &&
    countryCode &&
    !place.isPending

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-28">
      <header className="space-y-1">
        <nav className="text-xs text-muted-foreground">
          <Link to="/cart" className="hover:underline">
            Cart
          </Link>
          <span className="mx-1">/</span>
          <span className="font-medium text-foreground">Checkout</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Checkout
        </h1>
        <p className="text-sm text-muted-foreground">
          {payMethod === "momo" && momoLab
            ? "Lab Mobile Money — not a production payment claim."
            : "Cash on delivery. Shipping attaches from the store API when you place the order."}
        </p>
      </header>

      {cartQ.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-48 w-full rounded-3xl" />
        </div>
      ) : null}

      {!cartQ.isLoading && items.length === 0 ? (
        <EmptyState
          title="Cart is empty"
          description="Add products with an offer before checkout."
          actionLabel="Browse market"
          actionTo="/"
        />
      ) : null}

      {items.length > 0 ? (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            {sessionQ.data && saved.length > 0 ? (
              <section className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-base font-bold">Saved addresses</h2>
                <ul className="space-y-2">
                  {saved.map((a) => {
                    const selected = selectedAddressId === a.id
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAddressId(a.id)
                            applyAddress(a, setters)
                          }}
                          className={cn(
                            "w-full rounded-2xl border p-4 text-left text-sm transition",
                            selected
                              ? "border-primary bg-primary/10 ring-1 ring-primary"
                              : "border-border hover:bg-muted/40",
                          )}
                        >
                          <p className="font-semibold">
                            {[a.firstName, a.lastName]
                              .filter(Boolean)
                              .join(" ")}
                            {a.isDefaultShipping ? (
                              <span className="ml-2 text-xs font-medium text-muted-foreground">
                                default
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-muted-foreground">
                            {[a.address1, a.city, a.countryCode?.toUpperCase()]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </button>
                      </li>
                    )
                  })}
                  <li>
                    <button
                      type="button"
                      onClick={() => setSelectedAddressId("new")}
                      className={cn(
                        "w-full rounded-2xl border border-dashed p-4 text-left text-sm font-medium transition",
                        selectedAddressId === "new"
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-border hover:bg-muted/40",
                      )}
                    >
                      Use a new address
                    </button>
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  Manage in{" "}
                  <Link to="/account" className="font-semibold underline">
                    Account
                  </Link>
                  .
                </p>
              </section>
            ) : sessionQ.data ? (
              <p className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                No saved addresses.{" "}
                <Link to="/account" className="font-semibold underline">
                  Add one in Account
                </Link>{" "}
                or fill the form below.
              </p>
            ) : (
              <p className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                <Link
                  to="/signin"
                  search={{ redirect: "/checkout" }}
                  className="font-semibold underline"
                >
                  Sign in
                </Link>{" "}
                to use saved addresses and attach the order to your account.
              </p>
            )}

            <form
              id="checkout-form"
              className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm"
              onSubmit={(e) => {
                e.preventDefault()
                place.mutate()
              }}
            >
              <h2 className="text-base font-bold">Delivery details</h2>
              <FormField
                label="Email"
                value={email || sessionQ.data?.email || ""}
                onChange={setEmail}
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  label="First name"
                  value={firstName}
                  onChange={setFirstName}
                  autoComplete="given-name"
                  required
                />
                <FormField
                  label="Last name"
                  value={lastName}
                  onChange={setLastName}
                  autoComplete="family-name"
                  required
                />
              </div>
              <FormField
                label="Phone"
                value={phone}
                onChange={setPhone}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
              />
              <FormField
                label="Street address"
                value={line1}
                onChange={setLine1}
                autoComplete="street-address"
                required
                placeholder="House number, street, area"
              />
              <FormField
                label="Landmark / directions (optional)"
                value={landmark}
                onChange={setLandmark}
                autoComplete="address-line2"
                placeholder="Near Goil station, blue gate…"
              />
              <FormField
                label="City"
                value={city}
                onChange={setCity}
                autoComplete="address-level2"
                required
              />
              <FormField
                label="Region / province"
                value={province}
                onChange={setProvince}
                autoComplete="address-level1"
                placeholder="e.g. Greater Accra"
              />
              <FormSelect
                label="Country"
                value={countryCode}
                onChange={setCountry}
                required
                error={
                  countriesQ.isError
                    ? countriesQ.error instanceof Error
                      ? countriesQ.error.message
                      : "Could not load countries"
                    : undefined
                }
              >
                {!countries.length ? (
                  <option value="">Loading…</option>
                ) : (
                  countries.map((c) => (
                    <option key={c} value={c}>
                      {c.toUpperCase()}
                    </option>
                  ))
                )}
              </FormSelect>
              <FormField
                label="GhanaPostGPS (optional)"
                value={postal}
                onChange={setPostal}
                autoComplete="postal-code"
                placeholder="e.g. GA-123-4567"
              />
              <p className="text-xs text-muted-foreground">
                Digital address helps riders when available — not required for
                cash on delivery.
              </p>

              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4 text-sm">
                <p className="font-bold">Shipping options</p>
                {shippingQ.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : null}
                {shippingQ.isError ? (
                  <p className="text-xs text-destructive">
                    {shippingQ.error instanceof Error
                      ? shippingQ.error.message
                      : "Could not load shipping options"}
                  </p>
                ) : null}
                {shippingQ.data && shippingQ.data.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {shippingQ.data.map((o) => (
                      <li
                        key={o.id}
                        className="flex justify-between gap-2 rounded-lg bg-background px-3 py-2"
                      >
                        <span>{o.name ?? o.id}</span>
                        {o.amount != null ? (
                          <span className="font-medium text-foreground">
                            {formatMoney(o.amount, cartQ.data?.currencyCode)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : shippingQ.isSuccess ? (
                  <p className="text-xs text-muted-foreground">
                    No options yet. Configure seller shipping in Mercur.
                  </p>
                ) : null}
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4 text-sm">
                <p className="font-bold">Payment</p>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                    payMethod === "cod"
                      ? "border-primary bg-primary/10"
                      : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="pay"
                    checked={payMethod === "cod"}
                    onChange={() => setPayMethod("cod")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold text-foreground">
                      Cash on delivery
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">
                      Pay the rider when your order arrives.
                    </span>
                  </span>
                </label>
                {momoLab ? (
                  <>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                        payMethod === "momo"
                          ? "border-primary bg-primary/10"
                          : "border-border",
                      )}
                    >
                      <input
                        type="radio"
                        name="pay"
                        checked={payMethod === "momo"}
                        onChange={() => setPayMethod("momo")}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-semibold text-foreground">
                          Mobile Money{" "}
                          <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                            Lab only
                          </span>
                        </span>
                        <span className="mt-0.5 block text-muted-foreground">
                          Real Paystack charge when keys are set — not simulated
                          success.
                        </span>
                      </span>
                    </label>
                    {payMethod === "momo" ? (
                      <FormSelect
                        label="Network"
                        value={momoProvider}
                        onChange={(v) => setMomoProvider(v as MomoProvider)}
                        required
                      >
                        <option value="mtn">MTN MoMo</option>
                        <option value="vodafone">Telecel / Vodafone</option>
                        <option value="airteltigo">AirtelTigo</option>
                      </FormSelect>
                    ) : null}
                  </>
                ) : (
                  <label className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-border p-3 opacity-50">
                    <input type="radio" name="pay" disabled className="mt-1" />
                    <span>
                      <span className="font-semibold">
                        Mobile Money (Paystack)
                      </span>
                      <span className="mt-0.5 block text-muted-foreground">
                        Not enabled — set VITE_FEATURE_MOMO_LAB=true for lab only.
                      </span>
                    </span>
                  </label>
                )}
              </div>

              {place.isError ? (
                <p className="text-sm text-destructive" role="alert">
                  {place.error instanceof Error
                    ? place.error.message
                    : "Checkout failed"}
                </p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="hidden min-h-12 w-full rounded-xl md:inline-flex"
                disabled={!canSubmit}
              >
                {place.isPending
                  ? payMethod === "momo"
                    ? "Starting MoMo…"
                    : "Placing order…"
                  : payMethod === "momo"
                    ? "Pay with Mobile Money (lab)"
                    : "Place COD order"}
              </Button>
            </form>
          </div>

          <aside className="h-max space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-24">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Order summary
            </p>
            <Price
              amount={cartQ.data?.total}
              currencyCode={cartQ.data?.currencyCode}
              size="lg"
              className="text-2xl"
            />
            <p className="text-xs text-muted-foreground">
              {items.length} line{items.length === 1 ? "" : "s"}
              {multiSeller ? " · multiple sellers" : ""}
            </p>
            <div className="space-y-3 border-t border-border pt-3">
              {sellerGroups.map((g) => (
                <div key={g.key}>
                  {g.seller?.name ? (
                    <SellerChip
                      seller={g.seller}
                      className="mb-1 block text-xs"
                    />
                  ) : null}
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {g.items.map((i) => (
                      <li key={i.id} className="flex justify-between gap-2">
                        <span className="line-clamp-1">
                          {i.title} × {i.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl"
              size="sm"
            >
              <Link to="/cart">Edit cart</Link>
            </Button>
          </aside>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <span className="text-muted-foreground">Total </span>
              <span className="font-semibold tabular-nums">
                {formatMoney(cartQ.data?.total, cartQ.data?.currencyCode)}
              </span>
            </div>
            <Button
              type="submit"
              form="checkout-form"
              size="lg"
              className="min-h-11 shrink-0 rounded-xl"
              disabled={!canSubmit}
            >
              {place.isPending
                ? "…"
                : payMethod === "momo"
                  ? "Pay MoMo (lab)"
                  : "Place COD order"}
            </Button>
          </div>
        </div>
      ) : null}

    </div>
  )
}
