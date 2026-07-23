import { ViewMore } from "@/components/shell/ViewMore"

type LoadMoreProps = {
  shown: number
  total: number
  loading?: boolean
  onLoadMore: () => void
  /** Override label — default Mowafer “View More” */
  label?: string
}

/**
 * PLP / search pagination — Mowafer View More pill only.
 * Replaces progress-bar “Load more” chrome.
 */
export function LoadMore({
  shown,
  total,
  loading,
  onLoadMore,
  label = "View More",
}: LoadMoreProps) {
  const hasMore = total > shown
  return (
    <ViewMore
      show={hasMore}
      label={label}
      loading={loading}
      onClick={onLoadMore}
    />
  )
}
