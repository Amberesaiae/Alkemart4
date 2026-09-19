import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CheckoutStepper } from "../CheckoutStepper"
import { AddressStep } from "../AddressStep"
import { DeliveryStep } from "../DeliveryStep"
import { PaymentStep } from "../PaymentStep"
import { SuccessStep } from "../SuccessStep"
import { useState } from "react"
import type { CheckoutStepId } from "../CheckoutStepper"
import type { CheckoutAddress } from "@/lib/checkout"

function Harness({ step }: { step: CheckoutStepId }) {
  const [address] = useState<CheckoutAddress>({
    first_name: "Ama",
    last_name: "Mensah",
    phone: "0240000000",
    address_1: "12 Independence Ave",
    city: "Accra",
    country_code: "gh",
  })
  return (
    <div>
      <CheckoutStepper current={step} />
      {step === "address" ? (
        <AddressStep
          address={address}
          email="ama@example.com"
          onEmail={() => {}}
          onChange={() => {}}
          onNext={() => {}}
        />
      ) : null}
      {step === "delivery" ? (
        <DeliveryStep shippingTotal={12} currencyCode="ghs" onBack={() => {}} onNext={() => {}} />
      ) : null}
      {step === "payment" ? (
        <PaymentStep method="cod" onMethod={() => {}} onBack={() => {}} onConfirm={() => {}} />
      ) : null}
      {step === "success" ? <SuccessStep orderId="ord_1" /> : null}
    </div>
  )
}

describe("CheckoutStepper", () => {
  it("shows only the current step panel", () => {
    render(<Harness step="delivery" />)
    expect(screen.getByTestId("step-panel-delivery")).toBeTruthy()
    expect(screen.queryByTestId("step-panel-address")).toBeNull()
    expect(screen.queryByTestId("step-panel-payment")).toBeNull()
    expect(screen.queryByTestId("step-panel-success")).toBeNull()
  })

  it("marks the current step in yellow (primary)", () => {
    render(<Harness step="payment" />)
    const mark = screen.getByTestId("step-mark-payment")
    expect(mark.getAttribute("data-current")).toBe("true")
    expect(mark.className).toMatch(/bg-primary/)
  })
})
