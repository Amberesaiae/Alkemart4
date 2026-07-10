import { Link } from "@tanstack/react-router";
import { Logo } from "./logo";

const columns = [
  {
    title: "All departments",
    links: ["Store directory", "Careers at alkemart Ghana", "Our company", "Sell on alkemart", "alkemart Business"],
  },
  {
    title: "Services",
    links: ["Grocery & Essentials", "Pharmacy", "Photo Center", "Vision Center", "Auto Care"],
  },
  {
    title: "Get to know us",
    links: ["About alkemart", "Newsroom", "Sustainability", "Community", "Ethics & Integrity"],
  },
  {
    title: "Customer Service",
    links: ["Help Center", "Contact Us", "Product Recalls", "Terms of Use", "Privacy Notice"],
  },
];

const internalRoutes: Record<string, string> = {
  "Help Center": "/help",
  "Contact Us": "/support",
  "Terms of Use": "/terms",
  "Privacy Notice": "/privacy",
};

export function SiteFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-[1600px] px-6 py-12">
        <div className="grid gap-8 md:grid-cols-5">
          <div className="md:col-span-1">
            <Logo />
            <p className="mt-4 text-sm opacity-80">
              Ghana's everyday marketplace. Save money. Live better. Delivered as fast as one hour.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wider opacity-90">
                {col.title}
              </h3>
              <ul className="space-y-2 text-sm opacity-80">
                {col.links.map((l) => {
                  const to = internalRoutes[l];
                  return (
                    <li key={l}>
                      {to ? (
                        <Link to={to} className="hover:underline">
                          {l}
                        </Link>
                      ) : (
                        <span className="cursor-default">{l}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col justify-between gap-4 border-t border-primary-foreground/10 pt-6 text-xs opacity-80 md:flex-row">
          <div>© 2026 alkemart Ghana Ltd. All Rights Reserved.</div>
          <div className="flex flex-wrap gap-4">
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
