import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "alkemart:wishlist";

let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function getSnapshot(): Set<string> {
  if (!cache) cache = readFromStorage();
  return cache;
}

function getServerSnapshot(): Set<string> {
  return new Set();
}

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => {
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function toggleId(key: string) {
  const next = new Set(getSnapshot());
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  cache = next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
  notify();
}

/**
 * Lightweight client-side "saved for later" list, backed by a module-level
 * external store synced to localStorage (via useSyncExternalStore, so
 * toggles made in one BookmarkToggle instance are reflected everywhere
 * without triggering "setState during render" issues). There is no backend
 * wishlist API yet. Accepts either a real product id or any other stable
 * string key (e.g. a React useId() fallback for demo/placeholder cards).
 */
export function useWishlist(id?: number | string) {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const key = id !== undefined ? String(id) : undefined;
  const saved = key !== undefined ? ids.has(key) : false;

  const toggle = useCallback(() => {
    if (key !== undefined) toggleId(key);
  }, [key]);

  return { saved, count: ids.size, toggle };
}
