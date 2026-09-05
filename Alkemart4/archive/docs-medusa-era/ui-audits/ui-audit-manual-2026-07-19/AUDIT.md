# Manual UI/UX audit — 2026-07-19

Walked shop (desktop + mobile), seller login, admin login & ops queues as a real user.
Not a Playwright CI suite — visual headed session + copy/structure review.

## Issues found → fixed

| # | Surface | Issue | Fix |
|---|---------|-------|-----|
| 1 | Shop header | Guest avatar showed **?** (broken feel) | User icon on muted chip |
| 2 | Shop sign-in | Engineering copy (“Medusa emailpass”) | Human shopper copy |
| 3 | Shop register | “Register with emailpass. No hardcoded demo users.” | Friendly onboarding line |
| 4 | Create account menu | Same URL as Sign in, no mode | `?mode=register` opens register tab |
| 5 | Featured / cards | Empty gray void when no photo | Soft gold monogram placeholder + “Photo soon” on cards |
| 6 | “No offer” badge | Harsh / jargon | “Coming soon” |
| 7 | Cart empty (live worktree) | “live offer” jargon | Local sellers language |
| 8 | Footer (live worktree) | “Catalog… store API” | Customer marketplace blurb |
| 9 | Admin seller queue | “Mercur suspend…” ops jargon | Clear approve/reject language |
| 10 | Admin product review | Mercur status jargon | Confirm / request changes / reject |

## Still open (data / deeper product)

- **Catalog photos empty** — API returns products with blank `thumbnail`. UI placeholders now, but sellers must upload real images for retail quality.
- **Seller store-select** — clean multi-vendor list (Lab Shop + Lamp Store); shell load can flash empty briefly.
- **Admin post-login** needs session; cold open of queue URLs redirects to login (expected).
- **Chrome DevTools MCP** still “Target closed” in this environment — used headed Chromium for walk + image review.

## Screenshots

Before: `01`–`16` · After polish: `20`–`26` in this folder.
