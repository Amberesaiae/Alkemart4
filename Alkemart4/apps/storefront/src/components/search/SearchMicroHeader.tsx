import { Link } from "@tanstack/react-router"

export function SearchMicroHeader() {
  return (
    <header className="flex items-center justify-between px-4 py-3 sm:px-6">
      <span className="text-xl font-extrabold tracking-tight text-foreground">
        alkemart<span className="text-primary">.</span>
      </span>
      <Link
        to="/"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-foreground underline underline-offset-2"
      >
        ← Back to shop
      </Link>
    </header>
  )
}
