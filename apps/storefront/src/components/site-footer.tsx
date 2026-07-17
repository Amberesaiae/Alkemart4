import { Link } from "@tanstack/react-router"
import { getMercurAdminUrl, getMercurVendorUrl } from "@/lib/env"

export function SiteFooter() {
  let sellUrl = ""
  let adminUrl = ""
  try {
    sellUrl = getMercurVendorUrl()
  } catch {
    /* optional */
  }
  try {
    adminUrl = getMercurAdminUrl()
  } catch {
    /* optional */
  }

  return (
    <footer className="mt-auto border-t border-border bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <p className="text-lg font-extrabold tracking-tight text-foreground">
            alkemart<span className="text-primary">.</span>
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            Multi-seller marketplace for Ghana. Catalog and prices come from the
            store API.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">
            Shop
          </p>
          <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
            <Link
              to="/browse/$slug"
              params={{ slug: "all" }}
              className="hover:text-foreground"
            >
              All products
            </Link>
            <Link to="/sellers" className="hover:text-foreground">
              Sellers
            </Link>
            <Link to="/sell" className="hover:text-foreground">
              Sell on alkemart
            </Link>
            <Link to="/search" search={{ q: "" }} className="hover:text-foreground">
              Search
            </Link>
          </nav>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">
            Customer
          </p>
          <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
            <Link to="/orders" className="hover:text-foreground">
              Orders
            </Link>
            <Link to="/account" className="hover:text-foreground">
              Account
            </Link>
            <Link to="/help" className="hover:text-foreground">
              Help
            </Link>
            <Link to="/cart" className="hover:text-foreground">
              Cart
            </Link>
          </nav>
        </div>

        {(sellUrl || adminUrl) && (
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">
              Partners
            </p>
            <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/partners" className="hover:text-foreground">
                Partners &amp; ops
              </Link>
              {sellUrl ? (
                <a
                  href={sellUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  Seller Hub
                </a>
              ) : null}
              {adminUrl ? (
                <a
                  href={adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  Admin
                </a>
              ) : null}
            </nav>
          </div>
        )}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-[11px] text-muted-foreground sm:flex-row sm:justify-between">
          <span>Cash on delivery available at checkout</span>
          <span>alkemart storefront</span>
        </div>
      </div>
    </footer>
  )
}
