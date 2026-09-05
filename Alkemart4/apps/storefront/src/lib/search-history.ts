import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

const STORAGE_KEY = "alk_device_id"
const HISTORY_KEY = ["store", "search-history"]

function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

function headers() {
  return {
    "X-Device-Id": getDeviceId(),
    "Content-Type": "application/json",
  }
}

function apiBase(): string {
  return (import.meta.env as Record<string, string>).VITE_MEDUSA_BACKEND_URL || ""
}

function useWorkersSearchHistory(): boolean {
  return Boolean(
    (import.meta.env as Record<string, string>).VITE_ALKEMART_API_URL?.trim(),
  )
}

async function fetchHistory(): Promise<{ recent: string[]; frequent: string[] }> {
  if (useWorkersSearchHistory()) return { recent: [], frequent: [] }
  const base = apiBase()
  if (!base) return { recent: [], frequent: [] }
  const res = await fetch(`${base}/store/search/history`, { headers: headers() })
  if (!res.ok) return { recent: [], frequent: [] }
  return res.json()
}

async function trackSearchQuery(query: string) {
  if (useWorkersSearchHistory()) return
  const base = apiBase()
  if (!base) return
  await fetch(`${base}/store/search/track`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ query }),
  })
}

async function removeQuery(query: string) {
  if (useWorkersSearchHistory()) return
  const base = apiBase()
  if (!base) return
  await fetch(`${base}/store/search/history`, {
    method: "DELETE",
    headers: headers(),
    body: JSON.stringify({ query }),
  })
}

async function clearAll() {
  if (useWorkersSearchHistory()) return
  const base = apiBase()
  if (!base) return
  await fetch(`${base}/store/search/history`, {
    method: "DELETE",
    headers: headers(),
  })
}

export function useSearchHistory() {
  const qc = useQueryClient()
  const history = useQuery({
    queryKey: HISTORY_KEY,
    queryFn: fetchHistory,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })

  const track = useMutation({
    mutationFn: trackSearchQuery,
    onSuccess: () => qc.invalidateQueries({ queryKey: HISTORY_KEY }),
  })

  const remove = useMutation({
    mutationFn: removeQuery,
    onSuccess: () => qc.invalidateQueries({ queryKey: HISTORY_KEY }),
  })

  const clear = useMutation({
    mutationFn: clearAll,
    onSuccess: () => qc.setQueryData(HISTORY_KEY, { recent: [], frequent: [] }),
  })

  return {
    recent: history.data?.recent ?? [],
    frequent: history.data?.frequent ?? [],
    isLoading: history.isLoading,
    trackSearch: track.mutate,
    removeQuery: remove.mutate,
    clear: clear.mutate,
  }
}
