import { Link } from "@tanstack/react-router"
import { CheckCircle } from "@phosphor-icons/react"
import { Button } from "@workspace/ui"

type Props = {
  orderId: string
}

export function SuccessStep({ orderId }: Props) {
  return (
    <div className="space-y-4 py-6 text-center" data-testid="step-panel-success">
      <CheckCircle size={56} weight="fill" className="mx-auto text-primary" aria-hidden />
      <h2 className="text-2xl font-bold tracking-tight">Order confirmed</h2>
      <p className="text-sm text-muted-foreground">
        Order <span className="font-semibold text-foreground">{orderId}</span> is in. Track it from your purchases.
      </p>
      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Button className="rounded-full" asChild>
          <Link to="/cart">Track order</Link>
        </Button>
        <Button variant="outline" className="rounded-full" asChild>
          <Link to="/login">My Orders</Link>
        </Button>
      </div>
    </div>
  )
}
