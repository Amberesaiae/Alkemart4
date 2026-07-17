/**
 * Prefixes a server-relative path (e.g. `/images/objects/abc`) with the
 * `/api` mount point the API server is proxied under, for use in places
 * (like <img src>) that can't go through the generated api-client-react
 * fetch wrapper.
 */
export function getApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `/api${path.startsWith("/") ? path : `/${path}`}`;
}
