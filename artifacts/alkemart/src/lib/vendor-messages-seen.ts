/**
 * Helpers for tracking the vendor's last-seen timestamp for the Messages page.
 * The sidebar uses this to compute an unread count without a server round-trip.
 */
export const VENDOR_MESSAGES_LAST_SEEN_KEY = "vendor_messages_last_seen";

/** Call when the Messages page is opened to clear the unread indicator. */
export function markMessagesAsSeen(): void {
  try {
    localStorage.setItem(VENDOR_MESSAGES_LAST_SEEN_KEY, new Date().toISOString());
  } catch {
    // localStorage not available (SSR, private mode, storage full)
  }
}

/** Returns the last-seen Date, or epoch if never set. */
export function getLastSeenAt(): Date {
  try {
    const raw = localStorage.getItem(VENDOR_MESSAGES_LAST_SEEN_KEY);
    return raw ? new Date(raw) : new Date(0);
  } catch {
    return new Date(0);
  }
}
