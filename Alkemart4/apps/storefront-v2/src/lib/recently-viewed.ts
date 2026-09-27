const STORAGE_KEY = "alkemart:recently-viewed:v1";
const MAX_RECENT = 12;

export function parseRecentlyViewed(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function readRecentlyViewed(): string[] {
  if (typeof window === "undefined") return [];
  return parseRecentlyViewed(window.localStorage.getItem(STORAGE_KEY));
}

export function rememberRecentlyViewed(productId: string): void {
  if (typeof window === "undefined" || !productId) return;
  const next = [
    productId,
    ...readRecentlyViewed().filter((id) => id !== productId),
  ].slice(0, MAX_RECENT);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
