import { Button } from "@/components/ui/button"

type LoadMoreProps = {
  shown: number
  total: number
  loading?: boolean
  onLoadMore: () => void
}

/** Only renders when more rows exist according to API count. */
export function LoadMore({ shown, total, loading, onLoadMore }: LoadMoreProps) {
  if (total <= shown) return null
  return (
    <div className="flex flex-col items-center gap-3 pt-4">
      <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${Math.min(100, Math.round((shown / Math.max(total, 1)) * 100))}%`,
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {shown} of {total}
      </p>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 rounded-xl px-8"
        disabled={loading}
        onClick={onLoadMore}
      >
        {loading ? "Loading…" : "Load more"}
      </Button>
    </div>
  )
}
