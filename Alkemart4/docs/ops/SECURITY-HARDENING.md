# Security hardening — 2026-09-27

This records local implementation, not a claim that production is protected.
The initial local pass did not rotate live passwords, change stock, configure
providers, or deploy. See the subsequent Access rollout below for remote changes.
Exposed credentials remain an urgent incident until rotated.

## Cloudflare Access rollout — partial, 2026-09-27

- Verified the existing Google identity provider in team
  `proud-block-b3f8.cloudflareaccess.com` using a privately supplied CLI token.
- Enabled organization MFA enrollment methods (TOTP, biometrics, security key),
  with one-hour MFA validity. Global MFA enforcement is off: unrelated applications
  are not forced into MFA by this change.
- Created `Alkemart Admin` Access application
  `8bae3499-eb8d-45ed-b680-2c9abebbf7a6`, covering
  `alkemart4-admin.pages.dev`, Google provider only, one-hour sessions, and explicit
  independent MFA requirements. Its only Allow policy includes
  `isaiahamber5@gmail.com` and `akpey.mawuena@gmail.com`.
- Verified unauthenticated production admin requests return a 302 Access login
  redirect; storefront and vendor production pages still return 200.
- Added a second Access application for admin preview aliases
  `*.alkemart4-admin.pages.dev` (`6ed3a102-b799-40ae-9fa0-a020046c578a`)
  with the same Google/email/MFA requirements. No unrelated Pages sites changed.
- Locally implemented (NOT DEPLOYED): same-origin `/api/admin/*` Pages Function
  forwarding the signed Access assertion; production admin UI calls use it; the
  Worker rejects direct `/admin/*` requests unless the signature, issuer,
  audience, expiry, and approved email validate against Cloudflare's public keys.
  This keeps direct `workers.dev` access from bypassing Access after deployment.
- The proxy and Worker are not yet deployed. The current production Worker still
  accepts direct admin API requests with its legacy token. Do not mistake the
  frontend Access gate for complete protection. Authenticated MFA enrollment and
  unauthorized identity flows are still untested. No password/stock write occurred.
- Before rollout, isolate the substantial unrelated dirty worktree changes,
  then deploy and test API first, admin Pages second, exercising login, downloads,
  direct Worker denial, buyer/vendor continuity, and rollback. The API first
  deploy intentionally rejects old direct admin calls until Pages follows.
- Rollback of the frontend gate: delete only the above Access application after
  verifying its ID/domain. Do not alter unrelated applications or the Google IdP.

## Local changes

- Published passwords removed from DEMO-ACCOUNTS.md. Git history and test fixtures
  can still contain the old strings: rotation, not redaction, invalidates them.
- Admin JWTs last one hour; legacy seven-day admin JWTs are refused. Admin tokens
  use tab-scoped sessionStorage instead of persistent localStorage. This does not
  prevent XSS and is not a substitute for MFA or httpOnly provider sessions.
- Admin/seller authorization reads the current user role and password-change
  stamp. Seller membership is checked against the token's shop. Password rotation
  stamps changes and logs affected emails, never credentials; updates are atomic.
- `AUTH_RATE_LIMITER` is a SQLite-backed Durable Object namespace. Per-IP auth
  buckets allow 30 attempts/minute (shared across endpoints per actor), checkout
  allows 10/minute; normalized account/role login buckets allow 10 attempts/15 min
  across IPs. Attempts, including successes, count; windows expire automatically.
  This is bounded throttling, not a permanent lockout vulnerable to account DoS.
  Missing/unavailable production bindings fail closed with 503. Denials return
  429 and Retry-After. CF-Connecting-IP is trusted; forwarded headers are not.
  Existing in-isolate limits remain a secondary/local guard on other write paths.
- Production buyer/seller registration requires Turnstile server verification:
  success, expected `signup` action and allowed hostname. Provider errors fail
  closed. Tokens reset after submission and expiry; no secret is sent to the UI.
- Auth bodies are capped at 16 KiB; passwords at 200 characters. Unknown accounts
  perform dummy password verification rather than skip expensive password work.
- Stock tooling requires explicit handles/apply, refuses reserved inventory,
  saves a private backup from a locked transaction snapshot, and checks database
  identity/current inventory before restore. No live stock changes performed.

## Required production work (not completed)

1. Through a trusted operator, rotate the three documented demo accounts and
   every other test seller account that shares old credentials. Keep replacements
   in a password manager/CI secrets, not shell history, logs or source files. The
   rotation endpoint takes 14–200 characters and only handles the three listed
   demo emails. Other accounts need separately verified targets. Deploy the
   revocation fix before relying on it; confirm old sessions are denied.
2. Finish the Cloudflare Access rollout above. The admin Pages host and previews
   are now gated, but production `/admin/*` is not until the Worker verification
   and Pages proxy deploy. Verify signed Access JWTs/audience at the Worker and
   test allowed admin, non-admin, missing/expired proof and direct-host bypass.
   The existing admin password login remains as the app's inner authentication.
3. Create Turnstile widgets for the actual buyer/vendor hosts. Set API secret
   `TURNSTILE_SECRET_KEY` and comma-separated `TURNSTILE_HOSTNAMES`; build both
   UIs with public `VITE_TURNSTILE_SITE_KEY`. Enable CSP `script-src` and `frame-src`
   for `https://challenges.cloudflare.com` if CSP is enforced. Deploy API + UIs
   together: production sign-up fails closed without configuration. Never use
   the provider's public test keys in production.
4. Deploy the API Durable Object migration/binding; apply WAF rules at the actual
   API hostname, retaining signed Paystack webhooks without interactive challenge.
   Rate limits are not bot/DDoS protection. CORS is browser policy, not an API
   authentication barrier: scripts/non-browser clients can still reach the API.
5. Confirm exact demo shop handles before stock-out. Dry run lists shops only.
   Wait for pending reservations to resolve; then apply and retain the private
   backup. Restore now requires `--apply --restore=<file>` and rejects legacy
   unscoped backups or subsequent inventory changes. Rotate seller credentials
   first so old sessions cannot immediately restock.

## Password work factor: rollout blocked on runtime verification

OWASP recommends 600,000 iterations for PBKDF2-HMAC-SHA256:
https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
Cloudflare's default production limiter currently caps a single PBKDF2 call at
100,000; open-source/local workerd overrides that limit. A proposed change is
still open: https://github.com/cloudflare/workerd/pull/7550 . A local test passing
at 600k therefore does not demonstrate production compatibility.

The upgrade path is implemented but NOT enabled: `PASSWORD_HASH_ITERATIONS=600000`
selects the stronger work factor for signup/reset/change/rotation and upgrades
legacy hashes after successful login. A compare-and-swap avoids overwriting a
concurrent password reset, and rehashing alone does not revoke sessions. The
default remains 100k until the actual deployed runtime and CPU budget are proven.
Do not flip the setting blindly or downgrade existing stronger hashes. If the
runtime cannot support it, use a separately reviewed supported KDF or identity
provider migration; do not invent a chained home-grown derivation.

References: https://developers.cloudflare.com/durable-objects/ ;
https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ ;
https://workos.com/docs/authkit/mfa .

## Scope left outside this security pass

Deleting v1, committing the mixed worktree, live payment rehearsals, review-reply
UI and other product gaps are separate work. No destructive cleanup, git push,
provider-account creation or production deployment was inferred from the audit.
