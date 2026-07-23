---
name: Drizzle pg error unwrapping
description: How to detect specific Postgres error codes (e.g. foreign key violations) when catching errors from Drizzle ORM queries.
---

When a Drizzle query throws (e.g. a DELETE blocked by a foreign key constraint), the thrown error is a `DrizzleQueryError`. Its `message` is a generic "Failed query: ..." string — the actual Postgres error (with `.code`, e.g. `23503` for foreign_key_violation) is on `error.cause`, not on the thrown error directly.

**Why:** Drizzle wraps the underlying `pg` driver error to attach query/params context, but preserves the original error via the standard `Error.cause` chain rather than copying its fields onto itself.

**How to apply:** When you need to branch on a specific Postgres error code, unwrap first:
```ts
const pgError = error instanceof Error && error.cause instanceof Error ? error.cause : error;
const isForeignKeyViolation = typeof pgError === "object" && pgError !== null && "code" in pgError && pgError.code === "23503";
```
Checking `error.code` directly (without unwrapping `.cause`) will silently never match.
