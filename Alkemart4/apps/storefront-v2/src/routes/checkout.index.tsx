import { useEffect, useMemo, useRef, useState } from "react"
import { useVendorDirectory } from "@/hooks/use-vendors"
import { shopDeliveryText } from "@/lib/vendors"
import { BuyerProtection } from "@/components/commerce/buyer-protection"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  CreditCardIcon,
  DeliveryTruck01Icon,
  LockIcon,
  SmartPhone01Icon,
  Store04Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { BrandLogo } from "@/components/brand/brand-logo"
import { Price } from "@/components/commerce/price"
import { EmptyState, ErrorState } from "@/components/feedback/states"
import { PageSeo } from "@/components/seo/page-seo"
import { qk, useCart, useSession } from "@/hooks/use-store"
import { groupCartBySeller } from "@/lib/cart"
import {
  getFulfillmentOptions,
  placeGhanaOrder,
  type CheckoutAddress,
  type FulfillmentMethod,
  type MomoProvider,
  type PaymentMethod,
} from "@/lib/checkout"
import { cardCartId, lookupEmail } from "@/lib/checkout-session"
import { isCardEnabled, isMomoLabEnabled } from "@/lib/env"
import { formatMoney, useMarket, type AddressFieldKey } from "@/lib/market"
import { getStoreProduct } from "@/lib/products"
import { readSavedDelivery, writeSavedDelivery } from "@/lib/saved-address"
import { addressSummary, createAddress, listAddresses, type SavedAddress } from "@/lib/account"
import { rememberOrderId } from "@/lib/recent-orders"
import { trackCheckoutStarted, trackOrderCompleted } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import { getAlkemartApiUrl } from "@/lib/env"
import { LocationPicker, type Pin, type Place } from "@alkemart/maps"

export const Route = createFileRoute("/checkout/")({
  component: CheckoutPage,
})

type Form = {
  email: string
  first_name: string
  last_name: string
  phone: string
} & Record<AddressFieldKey, string>

const EMPTY: Form = {
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  address_1: "",
  address_2: "",
  city: "",
  province: "",
  postal_code: "",
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-3xl border border-border p-5 sm:p-7" aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="flex items-center gap-3 text-lg font-bold">
        <span className="grid size-8 place-items-center rounded-full bg-foreground text-sm text-background">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function CheckoutPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const market = useMarket()
  const cartQ = useCart()
  const session = useSession()
  const cart = cartQ.data
  const items = cart?.items ?? []
  const groups = groupCartBySeller(items)
  const vendors = useVendorDirectory()

  const saved = useMemo(() => readSavedDelivery(), [])
  const [form, setForm] = useState<Form>(() => {
    if (!saved) return EMPTY
    const a = saved.address
    return {
      email: saved.email ?? "",
      first_name: a.first_name ?? "",
      last_name: a.last_name ?? "",
      phone: a.phone ?? "",
      address_1: a.address_1 ?? "",
      address_2: a.address_2 ?? "",
      city: a.city ?? "",
      province: a.province ?? "",
      postal_code: a.postal_code ?? "",
    }
  })
  const [remember, setRemember] = useState(Boolean(saved))
  const [pin, setPin] = useState<Pin | null>(() =>
    saved?.address.latitude != null && saved.address.longitude != null ? { lat: saved.address.latitude, lng: saved.address.longitude } : null,
  )
  const [showMap, setShowMap] = useState(false)
  const [picks, setPicks] = useState<Record<string, FulfillmentMethod>>({})

  // Signed in: the account address book drives the address. The default is
  // picked on arrival; "new" shows the full form (and can save it back).
  const addrQ = useQuery({
    queryKey: ["store", "account", "addresses"],
    queryFn: listAddresses,
    enabled: Boolean(session.data),
    staleTime: 60_000,
  })
  const book = addrQ.data ?? []
  const [picked, setPicked] = useState<string | "new" | null>(null)
  const chosenId = picked ?? book.find((a) => a.isDefault)?.id ?? book[0]?.id ?? null
  const chosen = chosenId && chosenId !== "new" ? (book.find((a) => a.id === chosenId) ?? null) : null
  const [filledFrom, setFilledFrom] = useState<string | null>(null)
  if (chosen && filledFrom !== chosen.id) {
    // Adjust-during-render: copy the chosen address into the form once.
    setFilledFrom(chosen.id)
    setForm((f) => ({
      ...f,
      first_name: chosen.firstName,
      last_name: chosen.lastName,
      phone: chosen.phone,
      address_1: chosen.address1,
      address_2: chosen.address2 ?? "",
      city: chosen.city,
      province: chosen.province ?? "",
      postal_code: chosen.postalCode ?? "",
    }))
    setPin(chosen.latitude != null && chosen.longitude != null ? { lat: chosen.latitude, lng: chosen.longitude } : null)
  }
  const usingBook = Boolean(session.data && chosen)
  const [saveToBook, setSaveToBook] = useState(true)
  const [touched, setTouched] = useState(false)
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  // Signed-in buyers default to their account email (orders bind by email).
  // Delivery or pickup per seller, priced by the API for where the buyer is.
  // The key only changes on settled values (debounced), so typing a town
  // doesn't fire a request per keystroke.
  const [whereKey, setWhereKey] = useState({ city: "", region: "", lat: undefined as number | undefined, lng: undefined as number | undefined })
  useEffect(() => {
    const t = setTimeout(() => setWhereKey({ city: form.city.trim(), region: form.province.trim(), lat: pin?.lat, lng: pin?.lng }), 450)
    return () => clearTimeout(t)
  }, [form.city, form.province, pin?.lat, pin?.lng])
  const optionsQ = useQuery({
    queryKey: ["checkout-options", cartQ.data?.id, whereKey, cartQ.data?.items.length],
    queryFn: ({ signal }) => getFulfillmentOptions(cartQ.data!.id, whereKey, signal),
    // Don't guess before we know where the buyer is.
    enabled: Boolean(cartQ.data?.id && cartQ.data.items.length && (whereKey.city || whereKey.region || whereKey.lat != null)),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
  const optionsBySeller = new Map((optionsQ.data ?? []).map((o) => [o.sellerId, o]))
  const chosenOption = (sellerId: string) => {
    const opts = optionsBySeller.get(sellerId)?.options ?? []
    return opts.find((o) => o.method === picks[sellerId]) ?? opts.find((o) => o.method === "delivery") ?? opts[0] ?? null
  }
  const unservable = (whereKey.city || whereKey.region || whereKey.lat != null ? (optionsQ.data ?? []) : []).filter((o) => o.options.length === 0)
  const located = Boolean(whereKey.city || whereKey.region || whereKey.lat != null)
  const deliveryTotal = optionsQ.data && located
    ? optionsQ.data.reduce((sum, o) => sum + Number(chosenOption(o.sellerId)?.feePesewas ?? 0), 0) / 100
    : (cartQ.data?.shippingTotal ?? null)
  const orderTotal = cartQ.data?.itemTotal != null && deliveryTotal != null ? cartQ.data.itemTotal + deliveryTotal : (cartQ.data?.total ?? null)

  const email = form.email || session.data?.email || ""

  const methods = market.paymentMethods.filter(
    (m) => m === "cod" || (m === "momo" && isMomoLabEnabled()) || (m === "card" && isCardEnabled()),
  )
  const [pay, setPay] = useState<PaymentMethod>(methods[0] ?? "cod")
  const detected = market.detectMobileMoney(form.phone)
  const [network, setNetwork] = useState<MomoProvider | null>(null)
  const momoNetwork = network ?? detected ?? market.mobileMoney[0]?.id ?? null

  const started = useRef(false)
  useEffect(() => {
    if (started.current || !cart?.items.length) return
    started.current = true
    trackCheckoutStarted({ itemCount: cart.items.length, cartTotal: cart.total, currency: cart.currencyCode })
  }, [cart])

  // Line art for the summary (cached product queries).
  const ids = [...new Set(items.map((i) => i.productId).filter(Boolean) as string[])]
  const productQs = useQueries({
    queries: ids.map((id) => ({ queryKey: qk.product(id), queryFn: () => getStoreProduct(id), staleTime: 300_000 })),
  })
  const thumbs = new Map(productQs.flatMap((q) => (q.data ? [[q.data.id, q.data.thumbUrl ?? q.data.thumbnail] as const] : [])))

  const required = ["email", "first_name", "last_name", "phone", ...market.address.fields.filter((f) => f.required).map((f) => f.key)] as (keyof Form)[]
  const missing = required.filter((k) => !(k === "email" ? email : form[k]).trim())
  const phoneDigits = form.phone.replace(/\D/g, "")
  const phoneInvalid = phoneDigits.length > 0 && phoneDigits.length < 9
  const emailInvalid = email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const valid = missing.length === 0 && !phoneInvalid && !emailInvalid && (pay !== "momo" || Boolean(momoNetwork)) && unservable.length === 0

  const place = useMutation({
    mutationFn: () => {
      const address: CheckoutAddress = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        address_1: form.address_1.trim(),
        address_2: form.address_2.trim() || undefined,
        city: form.city.trim(),
        province: form.province.trim() || undefined,
        country_code: market.countryCode,
        postal_code: form.postal_code.trim() || undefined,
        ...(pin ? { latitude: pin.lat, longitude: pin.lng } : {}),
      }
      if (!session.data) writeSavedDelivery(remember ? { email: email.trim(), address } : null)
      if (session.data && !usingBook && saveToBook) {
        // Best effort: an address-book hiccup must never block the order.
        void createAddress({
          label: book.length ? null : "Home",
          firstName: address.first_name,
          lastName: address.last_name,
          phone: address.phone,
          address1: address.address_1,
          address2: address.address_2 ?? null,
          city: address.city,
          province: address.province ?? null,
          postalCode: address.postal_code ?? null,
          countryCode: address.country_code,
          latitude: pin?.lat ?? null,
          longitude: pin?.lng ?? null,
        })
          .then(() => queryClient.invalidateQueries({ queryKey: ["store", "account", "addresses"] }))
          .catch(() => undefined)
      }
      return placeGhanaOrder({
        address,
        email: email.trim(),
        paymentMethod: pay,
        momoProvider: pay === "momo" ? (momoNetwork ?? undefined) : undefined,
        callbackUrl: pay === "card" ? `${window.location.origin}/checkout/card-callback` : undefined,
        fulfillment: optionsQ.data
          ? Object.fromEntries(optionsQ.data.flatMap((o) => {
              const c = chosenOption(o.sellerId)
              return c ? [[o.sellerId, c.method]] : []
            }))
          : undefined,
      })
    },
    onSuccess: (r) => {
      lookupEmail.set(email.trim())
      if (r.status === "card_redirect") {
        cardCartId.set(r.cart_id)
        window.location.assign(r.authorization_url)
        return
      }
      if (r.status === "payment_pending") {
        void navigate({ to: "/checkout/pending", search: { cart_id: r.cart_id, ref: r.client_reference ?? r.provider_reference ?? "" } })
        return
      }
      rememberOrderId(r.order_id)
      queryClient.setQueryData(qk.cart, null)
      trackOrderCompleted({ orderId: r.order_id, paymentMethod: pay, itemCount: items.length, total: cart?.total ?? null, currency: cart?.currencyCode ?? null })
      void navigate({ to: "/order/$id", params: { id: r.order_id }, search: { placed: "1", pay }, replace: true })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "We couldn't place your order"),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (unservable.length) {
      toast.error(`${unservable[0]!.sellerName} can't get this order to you. Remove their items from your cart.`)
      return
    }
    if (!valid) {
      toast.error("Please complete the highlighted details")
      document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus()
      return
    }
    place.mutate()
  }
  const bad = (k: keyof Form) => touched && (missing.includes(k) || (k === "phone" && phoneInvalid) || (k === "email" && emailInvalid))

  const cta =
    place.isPending
      ? pay === "card" ? "Opening secure payment…" : pay === "momo" ? "Sending prompt…" : "Placing order…"
      : pay === "card" ? `Pay ${formatMoney(orderTotal, cart?.currencyCode)} by card`
      : pay === "momo" ? `Pay ${formatMoney(orderTotal, cart?.currencyCode)} with mobile money`
      : `Place order · pay ${formatMoney(orderTotal, cart?.currencyCode)} on delivery`

  return (
    <div className="pb-16">
      <PageSeo title="Checkout" noindex />
      <div className="container-page flex items-center justify-between border-b border-border py-4">
        <Link to="/cart" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" /> Cart
        </Link>
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <HugeiconsIcon icon={LockIcon} className="size-4" /> Secure checkout
        </span>
      </div>

      <div className="container-page pt-6">
        {cartQ.isLoading ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            <Skeleton className="h-96 rounded-3xl" />
            <Skeleton className="h-72 rounded-3xl" />
          </div>
        ) : cartQ.isError ? (
          <ErrorState title="Your cart didn't load" error={cartQ.error} onRetry={() => void cartQ.refetch()} />
        ) : items.length === 0 ? (
          <>
            <h1 className="sr-only">Checkout</h1>
            <EmptyState title="Nothing to check out" description="Your cart is empty." action={{ label: "Start shopping", to: "/" }} />
          </>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_400px] lg:items-start">
            <div className="space-y-5">
              <h1 className="text-3xl font-extrabold">Checkout</h1>

              <Step n={1} title="Contact & delivery address">
                {!session.data ? (
                  <p className="-mt-2 text-sm text-muted-foreground">
                    Checking out as a guest.{" "}
                    <Link to="/login" search={{ redirect: "/checkout" }} className="font-semibold text-foreground underline-offset-4 hover:underline">
                      Sign in
                    </Link>{" "}
                    to see this order in your account.
                  </p>
                ) : null}
                {session.data && book.length ? (
                  <fieldset className="space-y-2.5">
                    <legend className="mb-2 text-sm font-medium">Deliver to</legend>
                    {book.map((a: SavedAddress) => (
                      <label
                        key={a.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors",
                          chosenId === a.id ? "border-foreground bg-surface" : "border-border hover:bg-muted/50",
                        )}
                      >
                        <input
                          type="radio"
                          name="saved-address"
                          className="mt-1 size-4 accent-foreground"
                          checked={chosenId === a.id}
                          onChange={() => {
                            setPicked(a.id)
                            setFilledFrom(null)
                          }}
                        />
                        <span className="min-w-0 text-[15px]">
                          <span className="block font-semibold">
                            {a.label ?? "Address"}
                            {a.isDefault ? <span className="ml-2 text-xs font-medium text-muted-foreground">Default</span> : null}
                          </span>
                          <span className="block text-muted-foreground">
                            {a.firstName} {a.lastName} · {a.phone}
                          </span>
                          <span className="block text-muted-foreground">{addressSummary({ label: null, address1: a.address1, city: a.city })}</span>
                        </span>
                      </label>
                    ))}
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-[15px] font-semibold",
                        chosenId === "new" ? "border-foreground bg-surface" : "border-dashed border-border hover:bg-muted/50",
                      )}
                    >
                      <input
                        type="radio"
                        name="saved-address"
                        className="size-4 accent-foreground"
                        checked={chosenId === "new"}
                        onChange={() => {
                          setPicked("new")
                          setFilledFrom(null)
                        }}
                      />
                      Use a new address
                    </label>
                  </fieldset>
                ) : null}
                <FieldGroup className="grid grid-cols-2 gap-x-3 gap-y-4">
                  <Field className="col-span-2" data-invalid={bad("email") || undefined}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input id="email" type="email" autoComplete="email" value={email} onChange={set("email")} aria-invalid={bad("email")} />
                    <FieldDescription>Your receipt and order updates go here.</FieldDescription>
                  </Field>
                  {!usingBook ? (
                  <>
                  <Field data-invalid={bad("first_name") || undefined}>
                    <FieldLabel htmlFor="first_name">First name</FieldLabel>
                    <Input id="first_name" autoComplete="given-name" value={form.first_name} onChange={set("first_name")} aria-invalid={bad("first_name")} />
                  </Field>
                  <Field data-invalid={bad("last_name") || undefined}>
                    <FieldLabel htmlFor="last_name">Last name</FieldLabel>
                    <Input id="last_name" autoComplete="family-name" value={form.last_name} onChange={set("last_name")} aria-invalid={bad("last_name")} />
                  </Field>
                  <Field className="col-span-2" data-invalid={bad("phone") || undefined}>
                    <FieldLabel htmlFor="phone">Phone</FieldLabel>
                    <div className="flex gap-2">
                      <span className="inline-flex h-9 items-center rounded-4xl border border-input bg-muted px-3 text-sm text-muted-foreground">
                        {market.phone.callingCode}
                      </span>
                      <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={market.phone.example} value={form.phone} onChange={set("phone")} aria-invalid={bad("phone")} />
                    </div>
                    <FieldDescription>{phoneInvalid && touched ? "That number looks too short." : market.phone.hint}</FieldDescription>
                  </Field>
                  {market.address.fields.map((f) => (
                    <Field key={f.key} className={f.key === "address_1" || f.key === "address_2" || f.key === "postal_code" ? "col-span-2" : undefined} data-invalid={bad(f.key) || undefined}>
                      <FieldLabel htmlFor={f.key}>
                        {f.label}
                        {!f.required && !f.label.includes("optional") ? <span className="font-normal text-muted-foreground"> (optional)</span> : null}
                      </FieldLabel>
                      {f.input === "select" ? (
                        <NativeSelect id={f.key} value={form[f.key]} onChange={set(f.key)} aria-invalid={bad(f.key)} className="w-full">
                          <NativeSelectOption value="">Choose…</NativeSelectOption>
                          {f.options?.map((o) => (
                            <NativeSelectOption key={o.value} value={o.value}>
                              {o.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Input
                          id={f.key}
                          placeholder={f.placeholder}
                          autoComplete={f.key === "address_1" ? "street-address" : f.key === "city" ? "address-level2" : f.key === "postal_code" ? "postal-code" : undefined}
                          value={form[f.key]}
                          onChange={set(f.key)}
                          aria-invalid={bad(f.key)}
                        />
                      )}
                    </Field>
                  ))}
                  </>
                  ) : null}
                </FieldGroup>
                {!usingBook ? <p className="text-sm text-muted-foreground">{market.address.help}</p> : null}
                {!usingBook ? (
                  <div className="space-y-3 rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{pin ? "Exact spot pinned" : "Pin your exact spot (optional)"}</p>
                        <p className="text-xs text-muted-foreground">
                          {pin ? "Your rider gets a map link to this spot." : "Riders find you first time — no calls asking for directions."}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowMap((v) => !v)} aria-expanded={showMap}>
                        {showMap ? "Done" : pin ? "Change" : "Open map"}
                      </Button>
                    </div>
                    {showMap ? (
                      <LocationPicker
                        apiBase={getAlkemartApiUrl()}
                        value={pin}
                        subject="your delivery spot"
                        onChange={(next: Pin, found: Place | null) => {
                          setPin(next)
                          if (!found) return
                          // Fill what's empty; never overwrite what the buyer typed.
                          setForm((f) => ({
                            ...f,
                            address_1: f.address_1 || [found.street, found.area].filter(Boolean).join(", "),
                            city: f.city || found.city || "",
                            province: f.province || found.regionName || "",
                          }))
                        }}
                      />
                    ) : null}
                    {pin ? (
                      <button type="button" className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:underline" onClick={() => setPin(null)}>
                        Remove pin
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {!session.data ? (
                  <label className="flex items-start gap-2.5 text-sm">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} className="mt-0.5" />
                  <span>
                    Remember these details on this device
                    <span className="block text-xs text-muted-foreground">Leave off on shared phones or computers.</span>
                  </span>
                </label>
                ) : !usingBook ? (
                  <label className="flex items-center gap-2.5 text-sm">
                    <Checkbox checked={saveToBook} onCheckedChange={(v) => setSaveToBook(Boolean(v))} />
                    Save this address to my account
                  </label>
                ) : null}
              </Step>

              <Step n={2} title="Delivery">
                <ul className="space-y-4">
                  {groups.map((g) => {
                    const sellerId = g.seller?.id ?? ""
                    const opts = located ? optionsBySeller.get(sellerId) : undefined
                    const chosen = chosenOption(sellerId)
                    const v = g.seller?.handle ? vendors.get(g.seller.handle) : undefined
                    const promise = v ? shopDeliveryText(v) : null
                    return (
                      <li key={g.key} className="space-y-2.5">
                        <p className="text-sm">
                          <span className="font-semibold">{g.seller?.name ?? "Seller"}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {g.items.length} item{g.items.length === 1 ? "" : "s"}
                            {promise ? ` · ${promise} after you order` : ""}
                          </span>
                        </p>
                        {opts && opts.options.length === 0 ? (
                          <p role="alert" className="rounded-2xl bg-destructive/10 p-3.5 text-sm text-destructive">
                            {g.seller?.name ?? "This seller"} doesn't deliver to {form.city || "your area"} and doesn't offer pickup. Remove their items to continue.
                          </p>
                        ) : opts ? (
                          <div role="radiogroup" aria-label={`How to get your order from ${g.seller?.name ?? "the seller"}`} className="grid gap-2 sm:grid-cols-2">
                            {opts.options.map((o) => {
                              const active = chosen?.method === o.method
                              const fee = Number(o.feePesewas) / 100
                              return (
                                <button
                                  key={o.method}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  onClick={() => setPicks((p) => ({ ...p, [sellerId]: o.method }))}
                                  className={cn(
                                    "flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left text-sm transition-colors",
                                    active ? "border-foreground bg-surface" : "border-border hover:border-foreground/30",
                                  )}
                                >
                                  <HugeiconsIcon icon={o.method === "pickup" ? Store04Icon : DeliveryTruck01Icon} className="mt-0.5 size-5 shrink-0" aria-hidden />
                                  <span className="min-w-0 flex-1">
                                    <span className="block font-semibold">{o.method === "pickup" ? "Pick up" : "Delivery"}</span>
                                    <span className="block text-muted-foreground">{o.method === "pickup" ? (opts.pickupPlace ?? "From the shop") : o.label.replace(/^Delivery · /, "To you · ")}</span>
                                  </span>
                                  <span className="font-semibold tabular">{fee === 0 ? "Free" : formatMoney(fee, cart?.currencyCode)}</span>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="rounded-2xl bg-surface p-3.5 text-sm text-muted-foreground">
                            {optionsQ.isError ? "Couldn't load delivery options — the seller's standard fee applies." : "Enter your town to see delivery options."}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
                <p className="text-sm text-muted-foreground">You'll get a short code with your order. Give it to the rider, or show it when you pick up.</p>
              </Step>

              <Step n={3} title="Payment">
                <div role="radiogroup" aria-label="Payment method" className="grid gap-2.5">
                  {methods.map((m) => {
                    const meta = {
                      cod: { icon: Wallet01Icon, title: "Pay on delivery", body: "Check your items with the rider, then pay cash or mobile money." },
                      momo: { icon: SmartPhone01Icon, title: "Mobile money", body: "Approve a prompt on your phone." },
                      card: { icon: CreditCardIcon, title: "Debit or credit card", body: "Pay securely with Paystack." },
                    }[m]
                    const active = pay === m
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setPay(m)}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                          active ? "border-foreground ring-1 ring-foreground" : "border-border hover:border-foreground/40",
                        )}
                      >
                        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", active ? "bg-brand" : "bg-surface")}>
                          <HugeiconsIcon icon={meta.icon} className="size-5" />
                        </span>
                        <span>
                          <span className="block font-semibold">{meta.title}</span>
                          <span className="text-sm text-muted-foreground">{meta.body}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                <BuyerProtection variant="card" cod={pay === "cod"} />
                {pay === "momo" ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">
                      Network{detected ? <span className="font-normal text-muted-foreground"> · detected from your number</span> : null}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {market.mobileMoney.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          aria-pressed={momoNetwork === n.id}
                          onClick={() => setNetwork(n.id)}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center",
                            momoNetwork === n.id ? "border-foreground ring-1 ring-foreground" : "border-border",
                          )}
                        >
                          <img src={n.logo} alt="" className="h-10 w-auto object-contain" />
                          <span className="text-xs font-semibold">{n.name}</span>
                          <span className="text-xs text-muted-foreground">{n.prefixes}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">The prompt goes to {form.phone || "the phone number above"}.</p>
                  </div>
                ) : null}
              </Step>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6">
              <div className="space-y-4 rounded-3xl border border-border p-5 sm:p-6">
                <h2 className="text-lg font-bold">Order summary</h2>
                <ul className="max-h-72 space-y-3 overflow-y-auto">
                  {items.map((l) => {
                    const img = l.productId ? thumbs.get(l.productId) : null
                    return (
                      <li key={l.id} className="flex items-center gap-3">
                        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface">
                          {img ? <img src={img} alt="" className="size-full object-contain p-1 mix-blend-multiply" /> : null}
                          <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
                            {l.quantity}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-sm font-medium">{l.title}</span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {l.seller?.name}
                          </span>
                        </span>
                        <span className="text-sm tabular">{formatMoney(l.unitPrice != null ? l.unitPrice * l.quantity : null, l.currencyCode)}</span>
                      </li>
                    )
                  })}
                </ul>
                <Separator />
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Items</dt>
                    <dd className="tabular">{formatMoney(cart?.itemTotal, cart?.currencyCode)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery</dt>
                    <dd className="tabular">{deliveryTotal ? formatMoney(deliveryTotal, cart?.currencyCode) : "Free"}</dd>
                  </div>
                  <Separator />
                  <div className="flex items-baseline justify-between">
                    <dt className="font-semibold">Total</dt>
                    <dd>
                      <Price amount={orderTotal} currency={cart?.currencyCode} size="lg" />
                    </dd>
                  </div>
                </dl>
                <Button type="submit" variant="brand" size="xl" className="w-full whitespace-normal" disabled={place.isPending}>
                  {cta}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  By placing your order you agree to our{" "}
                  <Link to="/terms" className="underline">terms</Link> and{" "}
                  <Link to="/privacy" className="underline">privacy policy</Link>.
                </p>
              </div>
              <div className="flex justify-center">
                <BrandLogo size="sm" asLink={false} className="opacity-60" />
              </div>
            </aside>
          </form>
        )}
      </div>
    </div>
  )
}
