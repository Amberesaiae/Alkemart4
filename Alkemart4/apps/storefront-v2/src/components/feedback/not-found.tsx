import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { PageSeo } from "@/components/seo/page-seo"

export function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <PageSeo title="Page not found" noindex />
      <div className="max-w-md space-y-4">
        <img src="/illustrations/not-found.webp" alt="" className="mx-auto h-40 w-auto" onError={(e) => (e.currentTarget.style.display = "none")} />
        <p className="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">404</p>
        <h1 className="text-3xl font-extrabold">We couldn't find that page</h1>
        <p className="text-muted-foreground">The link may be old, or the item may have been removed.</p>
        <div className="flex justify-center gap-2">
          <Button asChild size="lg">
            <Link to="/">Go home</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/search">Search</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
