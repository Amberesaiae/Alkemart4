import { Link } from "@tanstack/react-router"
import { Button, Price, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui"
import type { CartLine, StoreCart } from "@/lib/cart"
import { deptAccentClass } from "@/lib/catalog-nav"
import { cn } from "@/lib/utils"
import { normalizeCurrencyCode } from "@/lib/money"

type Props = {
  cart: StoreCart
  busy?: boolean
  onInc: (line: CartLine) => void
  onDec: (line: CartLine) => void
  onRemove: (line: CartLine) => void
}

export function CartTable({ cart, busy, onInc, onDec, onRemove }: Props) {
  return (
    <Table label="Shopping cart">
      <TableHeader>
        <TableRow>
          <TableHead>Products</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Count</TableHead>
          <TableHead className="text-end">Subtotal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cart.items.map((line) => {
          const sub = line.unitPrice != null ? line.unitPrice * line.quantity : null
          return (
            <TableRow key={line.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  {line.thumbnail ? (
                    <img src={line.thumbnail} alt="" className="size-14 rounded-lg object-cover" />
                  ) : (
                    <span className="flex size-14 items-center justify-center rounded-lg bg-muted text-[10px] uppercase">
                      Item
                    </span>
                  )}
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold">{line.title}</p>
                    {line.categoryName ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          deptAccentClass(line.categoryName, line.categoryHandle),
                        )}
                      >
                        {line.categoryName}
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      disabled={busy}
                      onClick={() => onRemove(line)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Price amount={line.unitPrice} currency={normalizeCurrencyCode(line.currencyCode)} size="sm" />
              </TableCell>
              <TableCell>
                <div className="inline-flex items-center gap-1">
                  <Button type="button" size="icon" variant="outline" disabled={busy} onClick={() => onDec(line)} aria-label="Decrease">
                    −
                  </Button>
                  <span className="min-w-6 text-center text-sm tabular-nums">{line.quantity}</span>
                  <Button type="button" size="icon" variant="outline" disabled={busy} onClick={() => onInc(line)} aria-label="Increase">
                    +
                  </Button>
                </div>
              </TableCell>
              <TableCell className="text-end">
                <Price amount={sub} currency={normalizeCurrencyCode(line.currencyCode)} size="sm" />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function CartTotals({ cart }: { cart: StoreCart }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <Price amount={cart.itemTotal} currency={normalizeCurrencyCode(cart.currencyCode)} size="sm" />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Delivery</span>
        {cart.shippingTotal != null ? (
          <Price amount={cart.shippingTotal} currency={normalizeCurrencyCode(cart.currencyCode)} size="sm" />
        ) : (
          <span className="text-xs text-muted-foreground">Set at checkout</span>
        )}
      </div>
      <div className="flex justify-between border-t border-border pt-2">
        <span className="font-semibold">Total</span>
        <Price amount={cart.total} currency={normalizeCurrencyCode(cart.currencyCode)} size="md" />
      </div>
      <Button className="w-full rounded-full" asChild>
        <Link to="/checkout">Place Order</Link>
      </Button>
    </div>
  )
}
