/**
 * Blueprint Phase 7A — send permission by category (pure, test-pinned).
 * Transactional carries the buyer's own order truth and cannot be opted
 * out of; promotional needs explicit opt-in (default deny); operational
 * rides along unless explicitly refused (default allow). Topics scope
 * seller dashboard categories; a whole-category row covers every topic.
 */

export type NotificationCategory = "transactional" | "promotional" | "operational"

export type PreferenceRow = {
  channel: string
  category: string
  topic: string | null
  optedIn: boolean
  frequencyCap: number | null
}

export function checkSendPermission(
  prefs: PreferenceRow[],
  input: { channel: string; category: NotificationCategory; topic?: string | null },
): { allowed: boolean; reason: string } {
  if (input.category === "transactional") {
    return { allowed: true, reason: "transactional service message" }
  }
  const applicable = prefs.filter(
    (p) =>
      p.channel === input.channel &&
      p.category === input.category &&
      (p.topic == null || p.topic === (input.topic ?? null)),
  )
  if (input.category === "promotional") {
    const granted = applicable.some((p) => p.optedIn)
    return granted
      ? { allowed: true, reason: "promotional opt-in on file" }
      : { allowed: false, reason: "no promotional opt-in" }
  }
  const refused = applicable.some((p) => !p.optedIn)
  return refused
    ? { allowed: false, reason: "operational opt-out on file" }
    : { allowed: true, reason: "operational default allow" }
}

/** Sliding-window frequency cap; null cap means unlimited. */
export function withinFrequencyCap(
  sentAt: Date[],
  cap: number | null,
  now: Date = new Date(),
  windowHours = 24,
): boolean {
  if (cap == null) return true
  if (cap <= 0) return false
  const floor = now.getTime() - windowHours * 3_600_000
  return sentAt.filter((d) => d.getTime() >= floor).length < cap
}
