import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Resolve merchandising CTA destinations.
 * Supports:
 * - `/browse/all` absolute shop paths
 * - `/browse/$slug` → all
 * - `/store/foo` vendor paths
 * - external http(s) URLs
 */
export function resolveCtaHref(ctaTo?: string | null): string | null {
  if (!ctaTo?.trim()) return null;
  const t = ctaTo.trim();
  if (t.includes("$slug")) return "/browse/all";
  return t;
}

export function MerchLink({
  to,
  className,
  children,
}: {
  to?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const href = resolveCtaHref(to);
  if (!href) {
    return <span className={className}>{children}</span>;
  }
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} className={className} rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  // Internal paths — use plain anchor for flexible admin-configured destinations
  // (TanStack typed routes can't cover every CMS path).
  if (href.startsWith("/browse/")) {
    const slug = href.replace(/^\/browse\//, "") || "all";
    return (
      <Link to="/browse/$slug" params={{ slug }} className={className}>
        {children}
      </Link>
    );
  }
  if (href.startsWith("/store/")) {
    const slug = href.replace(/^\/store\//, "");
    return (
      <Link to="/store/$slug" params={{ slug }} className={className}>
        {children}
      </Link>
    );
  }
  if (href === "/" || href === "/home") {
    return (
      <Link to="/" className={className}>
        {children}
      </Link>
    );
  }
  if (href === "/account/lists") {
    return (
      <Link to="/account/lists" className={className}>
        {children}
      </Link>
    );
  }
  if (href === "/account") {
    return (
      <Link to="/account" className={className}>
        {children}
      </Link>
    );
  }
  if (href === "/orders") {
    return (
      <Link to="/orders" className={className}>
        {children}
      </Link>
    );
  }
  if (href === "/help" || href === "/support" || href === "/terms" || href === "/privacy") {
    return (
      <Link to={href as "/help"} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
