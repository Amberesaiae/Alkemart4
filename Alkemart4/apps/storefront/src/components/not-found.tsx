import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md space-y-5 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        404
      </p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Page not found
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        That URL is not a route in this storefront.
      </p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Button asChild className="rounded-xl min-h-11">
          <Link to="/">Market</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl min-h-11">
          <Link to="/categories/$slug" params={{ slug: "all" }}>
            Browse
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl min-h-11">
          <Link to="/help">Help</Link>
        </Button>
      </div>
    </div>
  )
}
