import { useState } from "react"

/** Fallback until the API's `maxItems` is known; the API enforces the real limit. */
export const COMPARE_MAX = 4
const MAX = COMPARE_MAX

/** ⚖ Compare mode state for a listing: on/off and the picked products. */
export function useComparePicker() {
  const [on, setOn] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX ? s : [...s, id]))
  return {
    on,
    selected,
    setOn: (v: boolean) => {
      setOn(v)
      if (!v) setSelected([])
    },
    clear: () => setSelected([]),
    pick: on ? { selected, full: selected.length >= MAX, toggle } : undefined,
  }
}

