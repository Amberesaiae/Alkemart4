# WorkOS pilot integration

Status: **local implementation, NOT deployed or approved for live commerce**. Staging provider configuration is complete; the staging key passed a read-only validation. Buyer/vendor hosted login, account mapping, encrypted server sessions, and browser adapters are implemented behind flags. Production authentication remains unchanged. No paid custom-domain or email add-on was activated.

## Dedicated project

- Project: Alkemart (`project_01M3JKT17GMVTDF3QVH1H4H9D0`)
- Staging environment: `environment_01M3JKT1891V9XCVKKK2FRQ07A`
- Staging client: `client_01M3JKT1PCRXSK57A2M9T7GJ1Y`
- Staging application: Alkemart Marketplace (`app_01M3JKT1TKSXT08CA3R9JJXBY7`)
- Production environment: `environment_01M3JKT1V9DZP6RPTR8QM2P2QA` (configuration untouched)

Staging permits Google and email/password sign-in, requires email verification, checks compromised passwords, and sets a 12-character password minimum. MFA is optional at the provider level; vendor-sensitive operations still need an enforced step-up design. Access tokens expire in 5 minutes; sessions have a 7-day absolute limit and 24-hour inactivity limit. Default WorkOS authentication emails remain enabled. Google sign-in has not been tested in this new environment.

Exact localhost/127.0.0.1 web origins and logout destinations were registered for storefront port 5176 and vendor port 3004. Callback paths on API port 8787 are `/store/auth/workos/callback` and `/vendor/auth/workos/callback`. Routes now exist locally; flags stay disabled until migration and configuration are ready.

## Credential prerequisite

Place the Alkemart **staging application API key**, not the Codex MCP credential, in the Git-ignored `apps/api/.dev.vars` as `WORKOS_API_KEY`. Never commit or paste it into chat. The MCP connection exposes key metadata but has not exposed the secret needed for server-side code exchange. Client IDs above are public identifiers, not secrets.

## Implementation and release gates

Local implementation uses S256 PKCE, encrypted browser-bound single-use state, exact Origin checks, allowlisted return paths, and encrypted refresh credentials in PostgreSQL. HttpOnly host-only cookies identify sessions; five-minute local access credentials stay in memory. Every protected request checks local revocation and current account/membership state. WorkOS cutover rejects old marketplace bearer tokens; admin remains separate. Existing account linking requires the old password plus the matching verified provider identity, never an email-only merge. Logout revokes local and provider sessions; provider failure is reported without undoing local revocation. Interrupted refresh locks fail closed after 30 seconds. The fixed authenticated provider backchannel supplies user identity and session expiry; provider JWT role claims never grant local permissions.

Migration 0051 is tested against isolated embedded PostgreSQL, including RLS, identity uniqueness, single-use state, refresh compare-and-swap, expiry and revocation. This is not proof of production migration compatibility or a browser end-to-end test.

### Production domains acquired — 2026-09-28

The custom domains are now active: storefront `https://alkemart.com`, seller
`https://sell.alkemart.com`, API `https://api.alkemart.com`, and protected admin
`https://console.alkemart.com`. Worker source configuration and Pages deployment
defaults now use them. These source changes are not a deployed auth cutover.
Same-origin auth bridges still apply; production callbacks must be registered
on the storefront/seller origins before enabling WorkOS.

Initial production MCP inspection found **no active API keys**, Google and password
authentication disabled, and MFA off. Do not reuse the staging API key or assume
the Cloudflare admin Google provider configures WorkOS Google sign-in.

Production credential follow-up: the privately supplied key was accepted by a
read-only WorkOS users request (HTTP 200). MCP metadata confirmed usage of the
Alkemart production application's key. Wrangler stored it as WORKOS_API_KEY on
alkemart-api without exposing its value. This uploads only the secret, not the
local application release, and does not enable the authentication cutover.

Production Google is enabled and its OAuth credential reports Valid, with no
custom scopes and provider-token return disabled. The production default app
`app_01M3JKT22MN8GMW2G3V2PAEP12` has client ID
`client_01M3JKT2097PXF3Y42N1R74GV1`. Its previously empty callback/logout lists
were dry-run validated, saved, and read back through MCP:

- Callback: https://alkemart.com/store/auth/workos/callback (default)
- Callback: https://sell.alkemart.com/vendor/auth/workos/callback
- Logout: https://alkemart.com/login (default)
- Logout: https://sell.alkemart.com/login

No preview or localhost URL was added to production. This does not deploy the
Pages Functions or enable WORKOS_ENABLED. End-to-end Google sign-in is untested.

### Existing Cloudflare aliases (staging registration)

Hosted sign-in is served first-party by the API Worker through zone routes `alkemart.com/store/auth/workos/*` and `sell.alkemart.com/vendor/auth/workos/*` (apps/api/wrangler.toml). The earlier Pages Function proxies were retired on 2026-09-28: a Pages→Worker subrequest arrives from one shared Cloudflare address, which collapsed every buyer into a single auth rate-limit bucket. Commerce requests still use the Worker directly. pages.dev aliases do not offer hosted sign-in.

Configure the Worker with:

- `STOREFRONT_URL=https://alkemart4-storefront.pages.dev`
- `VENDOR_URL=https://alkemart4-vendor.pages.dev`
- `WORKOS_STOREFRONT_API_ORIGIN=https://alkemart4-storefront.pages.dev`
- `WORKOS_VENDOR_API_ORIGIN=https://alkemart4-vendor.pages.dev`

Register the two exact callback URLs on those Pages hosts and their exact logout destinations in the **staging** WorkOS application before testing. Never allow arbitrary preview origins. Build both apps with `VITE_WORKOS_ENABLED=1` only after the Worker is configured with `WORKOS_ENABLED=1`, its dedicated client ID/API key, and a separate high-entropy cookie encryption secret. Direct cross-site authentication configuration fails closed.

### Confirmed external blockers

The two Pages callback URLs and exact login-page logout destinations were
registered in the dedicated **staging** WorkOS application on 2026-09-28,
preserving all existing localhost registrations. Production WorkOS is untouched.

Wrangler read-only inspection on 2026-09-28 found only `JWT_SECRET` and `PAYSTACK_SECRET_KEY` configured as Worker secrets. WorkOS, cookie encryption, transactional mail, Turnstile and Access runtime configuration have not been deployed. Pages projects exist for storefront, vendor and admin. No staging database has been confirmed; the developer database can reach live data. Do not apply migrations there.

Staff may operate catalog, fulfillment, reviews/messages and uploads, but cannot change shop identity/policy/payment details, make refund decisions, or access payout/business/onboarding routes. Unknown staff write surfaces fail closed. Vendor step-up and independent payout-account verification remain release requirements; this permission boundary does not substitute for them.

1. Use server-side authorization-code exchange with PKCE, single-use state, exact callback validation, and allowlisted return destinations. Keep refresh credentials out of browser localStorage and logs; use protected server-managed sessions and secure HttpOnly cookies.
2. Map provider environment/issuer and subject to stable local user IDs. Do not merge accounts by email alone. Existing-account linking must prove ownership; preserve shop ownership and historical orders.
3. Keep authorization in the local database. Buyer capabilities and vendor memberships must support the same identity without accepting client-supplied roles. Never grant admin from WorkOS claims or email matching. Admin remains protected by Cloudflare Access.
4. Enforce vendor step-up for sensitive actions, session revocation, suspended-shop write blocking, and verified-owner payout restrictions. Keep automatic payouts disabled during the pilot.
5. Feature-gate migration, test callback failures/replay, cross-shop access, account linking, logout/revocation, and buyer/vendor workflows before enabling it. Do not apply migrations to the shared live database without an explicit rollout and backup plan.
6. Resolve production cookie topology: Pages and Workers default hostnames are cross-site. Use a suitable same-site custom-domain setup or same-origin proxy; do not rely on third-party cookies. This is separate from a paid WorkOS authentication domain.
7. Configure and test production Google credentials and actual authentication email delivery. Commerce receipts and order notifications still require the application's transactional-mail integration.
8. Complete the remaining gates in `BUYER-VENDOR-SECURITY-GATE.md`, including credential rotation, distributed abuse controls, full tests, and vendor/payout review. Provider configuration does not establish launch readiness.

References: [WorkOS sessions](https://workos.com/docs/authkit/sessions), [authorization URL](https://workos.com/docs/reference/authkit/authentication/get-authorization-url), [AuthKit React storage considerations](https://workos.com/docs/sdks/authkit-react).
