import { Link } from "@tanstack/react-router";
import { useGetCart } from "@/lib/hooks-cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pesewasToLabel } from "@/lib/money";

function CartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.5L22 8H6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="20" r="1.6" />
      <circle cx="17" cy="20" r="1.6" />
    </svg>
  );
}

/** Cart summary control for the site header. */
export function HeaderCartButton() {
  const { data: cart } = useGetCart();
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const itemCount = items.reduce((sum: number, line) => sum + line.qty, 0);
  const subtotal = cart?.subtotalPesewas ?? 0;

  return (
    <Button
      type="button"
      variant="ghost"
      className="relative h-11 gap-2 rounded-lg px-2 py-0"
      asChild
    >
      <Link
        to="/cart"
        aria-label={`View cart, ${itemCount} item${itemCount !== 1 ? "s" : ""}`}
      >
        <span className="relative inline-flex">
          <CartIcon className="h-6 w-6" />
          <Badge
            variant="default"
            aria-live="polite"
            className="absolute -right-2.5 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] tabular-nums"
          >
            {itemCount}
          </Badge>
        </span>
        <span className="hidden flex-col items-start leading-tight lg:flex">
          <span className="text-[11px] font-medium text-muted-foreground">Cart</span>
          <span className="text-sm font-semibold tabular-nums">{pesewasToLabel(subtotal)}</span>
        </span>
      </Link>
    </Button>
  );
}
