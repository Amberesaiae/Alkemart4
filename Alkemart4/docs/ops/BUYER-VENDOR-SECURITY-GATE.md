# Buyer and vendor release gate — 2026-09-27

Status: **NO-GO for deployment**. This is a source review and local mitigation,
not a production penetration test or a claim that the live service is secure.
Do not put public buyer/vendor sites behind the admin Cloudflare Access allowlist.

## 2026-09-28 implementation update

Follow-up after domain activation: Pages deployment defaults now use the custom
domains and refuse dirty-tree releases instead of passing `--commit-dirty=true`.
Production CORS source excludes localhost and retired Vercel sites; only exact
current domains and retained Pages aliases are allowed by default. Twelve CORS
and admin Access tests pass, API typecheck passes, and deployment shell syntax
passes. These changes have not been deployed.

Fresh live secret-name inspection still reports only JWT_SECRET and
PAYSTACK_SECRET_KEY. WorkOS production has no active API keys and Google/password
sign-in are disabled. Transactional mail and Turnstile secrets are absent. The
working tree has approximately 1,497 changed entries; isolate and review a release
before deploying. Domain health is not a substitute for the gates below.

Local WorkOS hosted login/session/account-linking is now implemented but remains
disabled. Old marketplace bearer credentials are rejected at cutover; reviews
require the current verified buyer, rather than a body email. Provider/local
logout and bounded refresh claims are implemented. Pilot staff permissions now
deny shop identity/policy/payment edits, financial return decisions,
payout/business/onboarding access and unknown staff writes.

Missing transactional mail fails closed in production/staging; development
logs contain no message content. Outbox sends use stable provider idempotency
keys. Authentication migration 0051 passes isolated PostgreSQL state/rotation/
revocation/RLS tests and the repository's idempotent migration convention.
Both storefront/vendor same-origin Pages auth Functions compile in Wrangler;
their exact callbacks/logout destinations are registered in **staging** WorkOS.

Wrangler confirmed the live Worker has only JWT and Paystack secret names
configured. Do not mistake local/provider configuration for a deployed fix.
An isolated staging database remains unconfirmed; migration 0050/0051 rollout,
real delivery, browser end-to-end sign-in, Access/abuse-control verification,
credential rotation, vendor step-up and payment/payout rehearsals remain gates.
No production database, payment or deployment was changed by this work.

Verification: the full API suite passed **440 tests**, with **11 skipped**,
using `--maxWorkers=1 --testTimeout=20000` on the loaded developer machine.
Three shared browser-session tests passed, including logout/restore races.
API/storefront/vendor typechecks and both Wrangler Pages Function builds
passed. A full regression pass is not a substitute for deployed E2E,
credential rotation or an external production security assessment.

## Protected paths and abuse cases

| Actor / abuse case | Current evidence | Required before release |
| --- | --- | --- |
| Stolen vendor session changes payout destination | Local change makes initial setup verified-owner-only and blocks replacement after first setup. Approval/reopening and payout creation/retry also require a current verified owner. | Build an identity-verified, logged change request with admin review, independent seller notification, payout hold, and step-up authentication. Independently verify payout-account ownership before first payout. |
| Seller views statement to trigger money movement | Statement GET previously called `autoPaySeller`; local change removes that side effect. | Audit all remaining event/cron payout triggers; require verified payout destination and review hold. |
| Suspended vendor keeps changing shop data | `requireSeller` checked current membership but not shop status. Local change blocks non-GET/HEAD vendor requests for suspended/terminated shops. | Test all vendor endpoints, including uploads and alternate API paths, for status and shop ownership. Define which read-only access remains for disputes. |
| Staff member changes sensitive shop data | Broad `requireSeller` grants owner and staff most routes. Payout detail is now owner-only locally. | Inventory every vendor route and make explicit owner/staff permissions; test cross-shop ID swapping. |
| Guest claims order or releases payout with order reference + email | Local change requires a verified buyer session for checkout, order read/lookup, and state-changing order actions. Email-only lookup is closed; buyer email must match the current account. Automatic payout remains **off** for the pilot. | Run staging abuse tests for cross-account order references, revoked sessions, old guest orders, and all payout transitions. |
| Revoked buyer session still reads/changes orders | Individual order lookup and `buyerOrder` previously verified JWT without password-change freshness. Local change shares active-buyer checks across both paths and tests password-change revocation. | Test role change and account deletion; keep guest proof separate. |
| Fake buyer/vendor signup, spam and credential stuffing | Local Turnstile and distributed auth rate limit are not deployed/configured. Local single-use email verification now gates buyer checkout/order access and first vendor payout setup. New shops remain pending approval. | Apply migration 0050, configure and test transactional email, deploy Turnstile plus Durable Object limits, verify vendor identity before approval, and check phishing, enumeration, and account recovery flows. Existing users need an email-verification path. |
| Price, stock, refund or payout manipulation | Checkout and seller scopes have partial server-side checks, but this review is not exhaustive. | Test server-side price/stock recomputation, concurrency/reservations, webhook authenticity/replay, refund/return abuse, payout ledger reconciliation, and exact amount/currency at every transition. |
| Published demo credentials and admin bypass | Credential rotation and direct Worker Access-JWT enforcement are still pending in production. | Rotate credentials, deploy isolated API/admin fixes, verify direct Worker denial and both allowed/unallowed Access identities. |

## Go/no-go evidence

### Implementation and rollout order

Local evidence on 2026-09-27: 54 targeted tests passed across buyer auth/orders,
vendor payment setup, admin seller approval and payout trust. API and both app
typechecks passed, including the final combined frontend recheck. This is not
the full regression suite, a browser end-to-end run, or
a production security assessment.

1. Local: verified buyer purchase/order gates, one-use hashed email tokens,
   verified owner approval/payout gates, suspended-shop write restrictions,
   and removal of money movement from statement GETs. Tests must prove these
   fail closed, not retain the previous guest expectations.
2. Before staging: apply migration 0050, configure real transactional email,
   Turnstile, distributed auth limits and Access enforcement. Verify existing
   buyers/vendors can request verification links. Do not auto-verify legacy
   email addresses or migrate guest orders based on an email assertion alone.
3. Before production: rotate exposed credentials; independently review vendor
   identity and payout-account ownership; run cross-role/shop, concurrency,
   webhook/replay and payment-refund-payout rehearsals. Keep automatic payouts
   disabled. Payout destination changes remain blocked until a reviewed,
   step-up-authenticated workflow is implemented.
4. Release only from a reviewed, clean commit with operator sign-off and rollback
   evidence. The current working tree contains extensive unrelated changes;
   this security work does not authorize shipping those changes wholesale.

Before deploy: finish each required item above or consciously defer it behind a
documented pilot control that removes the risk (for example, disable automatic
payouts and use a manual, independently verified settlement process). Run API
typecheck and relevant auth/order/payout tests, then staging end-to-end tests
for buyer, owner, staff, suspended seller, guest, admin, and cross-shop access.
Record the deployed commit, Cloudflare configuration, credential rotation,
rollback procedure, and operator sign-off. The local changes in this document
are not deployed.
