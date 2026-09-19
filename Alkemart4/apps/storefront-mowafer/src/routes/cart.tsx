import { createFileRoute, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Breadcrumbs, MerchEmpty } from "@workspace/ui"
import { CartTable, CartTotals } from "@/components/cart/CartTable"
import { retrieveCart, updateLineQuantity, removeLine } from "@/lib/cart"

export const Route = createFileRoute("/cart")({
  component: CartPage,
})

function CartPage() {
  const queryClient = useQueryClient()
  const cartQ = useQuery({
    queryKey: ["store", "cart"],
    queryFn: () => retrieveCart(),
  })
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["store", "cart"] })
  const qty = useMutation({
    mutationFn: ({ id, n }: { id: string; n: number }) => updateLineQuantity(id, n),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => removeLine(id),
    onSuccess: invalidate,
  })

  const cart = cartQ.data
  const items = cart?.items ?? []
  const busy = qty.isPending || remove.isPending

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Shopping Cart" },
          { label: "Delivery and Payment", href: "/checkout" },
        ]}
      />
      <h1 className="text-2xl font-extrabold tracking-tight">Cart</h1>

      {cartQ.isLoading ? <p className="text-sm text-muted-foreground">Loading cart…</p> : null}

      {!cartQ.isLoading && items.length === 0 ? (
        <MerchEmpty
          title="Your cart is empty"
          body="Add products from the catalog."
          action={
            <Link to="/" className="text-sm font-semibold underline">
              Continue shopping
            </Link>
          }
        />
      ) : null}

      {cart && items.length > 0 ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <CartTable
            cart={cart}
            busy={busy}
            onInc={(line) => qty.mutate({ id: line.id, n: line.quantity + 1 })}
            onDec={(line) => qty.mutate({ id: line.id, n: line.quantity - 1 })}
            onRemove={(line) => remove.mutate(line.id)}
          />
          <CartTotals cart={cart} />
        </div>
      ) : null}
    </div>
  )
}
