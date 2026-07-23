import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";
import { FOOTER_COLUMNS } from "@/lib/commerce-content";
import { MerchLink } from "@/lib/nav-link";
import { getMercurVendorUrl } from "@/lib/platform-features";

export function SiteFooter() {
  const sellerHubUrl = getMercurVendorUrl();

  return (
    <footer className="mt-6 border-t border-border bg-card text-foreground">
      <div className="shop-shell py-10 md:py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link to="/" className="inline-flex" aria-label="alkemart home">
              <Logo variant="onLight" />
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Ghana multi-vendor marketplace. Shop local sellers and pay with MoMo or
              card.
            </p>
            <a
              href={sellerHubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex text-sm font-semibold text-foreground underline-offset-2 hover:underline"
            >
              Sell on alkemart →
            </a>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {col.title}
              </h3>
              <ul className="space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <MerchLink to={l.to} className="hover:underline">
                      {l.label}
                    </MerchLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row">
          <div>© {new Date().getFullYear()} alkemart Ghana Ltd. All rights reserved.</div>
          <div className="flex flex-wrap gap-4">
            <span className="font-medium text-foreground/70">GHS · Ghana</span>
            <Link to="/terms" className="hover:underline">
              Terms of Use
            </Link>
            <Link to="/privacy" className="hover:underline">
              Privacy Notice
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
