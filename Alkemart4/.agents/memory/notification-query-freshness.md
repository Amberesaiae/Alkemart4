---
name: Cross-user notification/shared-data query freshness
description: TanStack Query caches for header/layout components go stale when data is created by another user's action (e.g. order notifications) rather than the viewer's own mutation.
---

When a shared layout component (header, sidebar) shows data that can be created by *someone else's* action — e.g. a vendor's notification created by a buyer's checkout, or any other server-side event fan-out — invalidating the query only on the local user's own mutation is not enough, because the recipient never fires that mutation.

**Why:** In the Alkemart notifications feature, the buyer's own checkout mutation could invalidate the buyer's notification list, but the vendor had no local mutation to hook into. Without polling, the vendor's header stayed stale until a manual page reload, which looked like a broken notification feature end-to-end.

**How to apply:** For this kind of cross-user/event-driven data, give the query a `refetchInterval` (short polling, e.g. 15s) and `refetchOnWindowFocus: true` on the shared component, in addition to (not instead of) invalidating on the actor's own mutation for immediacy. Pure invalidation-only strategies are insufficient whenever the consumer of the data isn't the one triggering the write.
