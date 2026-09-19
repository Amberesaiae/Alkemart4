import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MerchEmpty, Price } from "@workspace/ui"
import { CheckoutStepper, type CheckoutStepId } from "@/components/checkout/CheckoutStepper"
import { AddressStep } from "@/components/checkout/AddressStep"
import { DeliveryStep } from "@/components/checkout/DeliveryStep"
import { PaymentStep } from "@/components/checkout/PaymentStep"
import { SuccessStep } from "@/components/checkout/SuccessStep"
import { retrieveCart } from "@/lib/cart"
import { getSessionCustomer } from "@/lib/auth"
import { placeGhanaOrder, type CheckoutAddress } from "@/lib/checkout"

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
})

function emptyAddress(): CheckoutAddress {
  return {
    first_name: "",
    last_name: "",
    phone: "",
    address_1: "",
    city: "",
    country_code: "gh",
  }
}

function CheckoutPage() {
  const queryClient = useQueryClient()
  const cartQ = useQuery({
    queryKey: ["store", "cart"],
    queryFn: () => retrieveCart(),
  })
  const sessionQ = useQuery({
    queryKey: ["store", "session"],
    queryFn: () => getSessionCustomer(),
  })

  const [step, setStep] = useState<CheckoutStepId>("address")
  const [address, setAddress] = useState<CheckoutAddress>(emptyAddress)
  const [email, setEmail] = useState("")
  const [method, setMethod] = useState<"cod" | "card">("cod")
  const [orderId, setOrderId] = useState<string | null>(null)

  const effectiveEmail = email.trim() || sessionQ.data?.email?.trim() || ""

  const place = useMutation({
    mutationFn: () =>
      placeGhanaOrder({
        address,
        email: effectiveEmail,
        paymentMethod: method,
        callbackUrl: method === "card" ? `${window.location.origin}/checkout` : undefined,
      }),
    onSuccess: (result) => {
      if (result.status === "card_redirect") {
        window.location.assign(result.authorization_url)
        return
      }
      if (result.status === "completed") {
        setOrderId(result.order_id)
        setStep("success")
        void queryClient.invalidateQueries({ queryKey: ["store", "cart"] })
      }
    },
  })

  const cart = cartQ.data
  const empty = !cartQ.isLoading && !(cart?.items.length)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Checkout</h1>
      <CheckoutStepper current={step} />

      {empty && step !== "success" ? (
        <MerchEmpty
          title="Cart is empty"
          body="Add items before checking out."
          action={
            <Link to="/cart" className="text-sm font-semibold underline">
              Back to cart
            </Link>
          }
        />
      ) : null}

      {!empty && cart ? (
        <p className="text-sm text-muted-foreground">
          Total{" "}
          <Price amount={cart.total} currency={(cart.currencyCode ?? "GHS").toUpperCase()} size="sm" />
        </p>
      ) : null}

      {step === "address" && !empty ? (
        <AddressStep
          address={address}
          email={effectiveEmail}
          onEmail={setEmail}
          onChange={setAddress}
          onNext={() => setStep("delivery")}
        />
      ) : null}
      {step === "delivery" && !empty ? (
        <DeliveryStep
          shippingTotal={cart?.shippingTotal ?? null}
          currencyCode={cart?.currencyCode ?? null}
          onBack={() => setStep("address")}
          onNext={() => setStep("payment")}
        />
      ) : null}
      {step === "payment" && !empty ? (
        <PaymentStep
          method={method}
          onMethod={setMethod}
          pending={place.isPending}
          error={place.error instanceof Error ? place.error.message : null}
          onBack={() => setStep("delivery")}
          onConfirm={() => place.mutate()}
        />
      ) : null}
      {step === "success" && orderId ? <SuccessStep orderId={orderId} /> : null}
    </div>
  )
}
