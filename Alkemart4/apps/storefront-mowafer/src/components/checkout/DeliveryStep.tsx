import { Button, Price, RadioGroup, RadioGroupItem, Label } from "@workspace/ui"

type Props = {
  shippingTotal: number | null
  currencyCode: string | null
  onBack: () => void
  onNext: () => void
}

export function DeliveryStep({ shippingTotal, currencyCode, onBack, onNext }: Props) {
  return (
    <div className="space-y-4" data-testid="step-panel-delivery">
      <p className="text-sm text-muted-foreground">
        Standard delivery from the cart quote. Time slots are omitted until the API provides them.
      </p>
      <RadioGroup value="standard" className="gap-3">
        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="standard" id="ship-standard" />
            <Label htmlFor="ship-standard">Standard delivery</Label>
          </div>
          {shippingTotal != null ? (
            <Price amount={shippingTotal} currency={(currencyCode ?? "GHS").toUpperCase()} size="sm" />
          ) : (
            <span className="text-xs text-muted-foreground">Quoted at place order</span>
          )}
        </div>
      </RadioGroup>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="rounded-full" onClick={onBack}>
          Back
        </Button>
        <Button type="button" className="rounded-full" onClick={onNext}>
          Continue to payment
        </Button>
      </div>
    </div>
  )
}
