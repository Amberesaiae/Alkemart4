import { Link } from "@tanstack/react-router"

/**
 * Link for admin-authored hrefs: site paths navigate client-side (no full
 * reload), absolute URLs open in a new tab.
 */
export function SmartLink({
  href,
  children,
  ...rest
}: { href: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  if (href.startsWith("/") && !href.startsWith("//")) {
    const url = new URL(href, "https://x.invalid")
    return (
      <Link
        to={url.pathname as never}
        search={Object.fromEntries(url.searchParams) as never}
        hash={url.hash.replace(/^#/, "") || undefined}
        {...rest}
      >
        {children}
      </Link>
    )
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" {...rest}>
      {children}
    </a>
  )
}
