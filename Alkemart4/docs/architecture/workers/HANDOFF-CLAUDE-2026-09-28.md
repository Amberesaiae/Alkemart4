# Claude continuation — production authentication and launch

## Claude review of this work (2026-09-28)

Reviewed the local security implementation below. Design holds (PKCE, one-use
browser-bound state, CAS refresh lock, signed Access verification, pwd/sid
revocation). API suite: 447 passed / 17 skipped (80 files, --maxWorkers=1).
Revisions made (local, not deployed):

- **Pages auth proxies retired → Worker zone routes.** A Pages Function's
  subrequest reaches the Worker from one shared Cloudflare IP, so every buyer
  would share one 30/min `store:auth` bucket (and one checkout bucket) at
  cutover. wrangler.toml now routes `alkemart.com/store/auth/workos/*` and
  `sell.alkemart.com/vendor/auth/workos/*` to the Worker, keeps
  `api.alkemart.com` as a declared custom domain and `workers_dev = true`
  (admin Pages proxy still uses it). Old proxy code parked outside the repo.
- **Expired `workos_attempts` purged on each new attempt** (public /start
  could otherwise grow the table without bound).
- **Admin Access boundary is config, not code:** `ADMIN_ACCESS_TEAM/AUD/EMAILS`
  vars; production fails closed (503) when unset. Tests now cover a valid
  signed assertion, wrong identity/audience/issuer and missing config.

Owner decisions still open: guest checkout was removed (sign-in + verified
email required to buy, guest order lookup now needs sign-in). With production
mail not configured, deploying the backend would block every unverified buyer
from checkout — sequence mail before, or together with, the API release.


Latest handoff as of 2026-09-28, Africa/Accra. This supersedes older statements
that the domain is unpurchased, Google is unconfigured, or production has no
WorkOS key. **Public commerce security sign-off remains NO-GO.**

## Owner intent and constraints

Finish the remaining security/authentication gaps and a safe production rollout.
Use CLI and the connected WorkOS MCP wherever possible. Owner acquired
alkemart.com at Namecheap and approved all domain mappings below. Owner does not
want a separate staging Supabase project imposed as a prerequisite: use the
existing production database only with a verified backup, reviewed migrations,
rollback evidence, and explicit rollout controls. This does not waive testing.

Stay on main and preserve user changes. No push is authorized. Do not ship the
whole dirty tree: approximately **1,500 changed entries**, including unrelated
UI/illustration work. No commit was made during this continuation. Review and
isolate the intended release; coordinate a commit with the owner under repo rules.
Do not delete, stash, reset, or revert unrelated changes to get a clean checkout.
Read AGENTS.md and its required architecture/lifecycle docs first. Retired
apps/storefront, apps/backend/** and archive/** are not deployment targets.

## Live and verified

| Host | Resource | Verification |
| --- | --- | --- |
| alkemart.com | Pages alkemart4-storefront | HTTPS 200, domain/validation active |
| www.alkemart.com | Worker alkemart-www-redirect | 308 to HTTPS apex, preserves path/query |
| sell.alkemart.com | Pages alkemart4-vendor | HTTPS 200, domain/validation active |
| console.alkemart.com | Pages alkemart4-admin | Unauthenticated 302 to expected Access team |
| api.alkemart.com | Worker alkemart-api | /health HTTPS 200 |

Cloudflare account c057131d18c6e024ec4370e6292686d1; zone
266b7555ece5013cad456f258f032fed. Nameservers duke.ns.cloudflare.com and
stella.ns.cloudflare.com; zone active. Apex and www parking records replaced;
five Namecheap email-forwarding MX records and SPF TXT preserved. Existing
workers.dev and pages.dev aliases retained. No commerce app code was deployed
in this continuation. Only the isolated www redirect Worker was deployed;
source/config under infra/www-redirect. Early Pages 522/validation errors were
transient: final checks showed all three Pages domains active and live HTTP 200.

Admin Access app 8bae3499-eb8d-45ed-b680-2c9abebbf7a6 now covers both
alkemart4-admin.pages.dev and console.alkemart.com. Audience:
e841b78f33d66a76e22cf6e82159e78a8f087534e87545af6090110184478982.
Team https://proud-block-b3f8.cloudflareaccess.com. Google provider only, allowed
emails isaiahamber5@gmail.com and akpey.mawuena@gmail.com, one-hour session,
independent MFA enabled. Preview app 6ed3a102-b799-40ae-9fa0-a020046c578a retains
*.alkemart4-admin.pages.dev. Preserve both apps and unrelated policies.
**Live admin API bypass is still open:** signed-assertion backend enforcement and
same-origin admin Pages proxy are local only. Frontend Access is not full protection.

## WorkOS production — configured, not enabled in commerce

- Project project_01M3JKT17GMVTDF3QVH1H4H9D0.
- Production environment environment_01M3JKT1V9DZP6RPTR8QM2P2QA.
- Default app app_01M3JKT22MN8GMW2G3V2PAEP12 (display name Amber's Application).
- Production client ID client_01M3JKT2097PXF3Y42N1R74GV1.
- Production key metadata key_01M3JW6RASAQHKGWQ1RXAHCFCZ, name alke, no expiry.
  Read-only API validation returned 200; MCP last-used timestamp confirmed this
  production key. Wrangler uploaded WORKOS_API_KEY to the existing alkemart-api
  Worker. Secret list now has JWT_SECRET, PAYSTACK_SECRET_KEY, WORKOS_API_KEY.
- Google enabled; OAuth credential reports Valid; no custom scopes and
  returnProviderTokens=false. Cloudflare admin Google integration is separate.
- Callback and logout lists were inspected empty, dry-run validated, saved,
  then read back through MCP. Exact callbacks:
  https://alkemart.com/store/auth/workos/callback (default) and
  https://sell.alkemart.com/vendor/auth/workos/callback.
  Exact logout destinations https://alkemart.com/login (default) and
  https://sell.alkemart.com/login. No production localhost/previews added.
- Latest observed production settings: email verification required, password
  auth disabled, MFA Off, token expiry 300s, max session 31536000s, inactivity
  172800s. Tighten sessions to reviewed pilot policy (7d absolute/24h inactivity)
  before cutover. Do not globally force buyer MFA without product approval;
  vendor sensitive actions need independently enforced step-up.
- Do NOT use staging client/key in production. Staging configuration and
  localhost/pages.dev registrations remain separate, documented in WORKOS-PILOT.md.
- WorkOS MCP cannot create production keys (createApiKey unknown); owner created
  the key in dashboard. MCP supports inspection/configuration but does not return
  raw existing key secrets. Discover operation schemas with list_operations.

Private credentials are in /home/amber/Desktop/cd.md: multiple lines, including
Cloudflare and WorkOS keys. Read programmatically; do not print the file or key.
Identify exact key types, never feed the whole file into Authorization. Wrangler
OAuth is privately stored in /home/amber/.config/.wrangler/config/default.toml.
Never echo it. Use stdin for wrangler secret put. Do not commit secrets, log
provider responses containing tokens, or paste credentials into conversation.
Do not delete the owner's multi-credential file without direction. Earlier tokens
posted in chat should be revoked after verifying replacements and access continuity.

## Local security implementation and most recent edits

Read docs/ops/BUYER-VENDOR-SECURITY-GATE.md, WORKOS-PILOT.md and
SECURITY-HARDENING.md for detailed implementation. Summary:

- WorkOS S256 PKCE, encrypted browser-bound one-use callback state, stable local
  identity mapping, explicit old-password account linking (never email-only merge).
- Encrypted provider refresh credentials in PostgreSQL, host-only HttpOnly Lax
  secure cookies, short local access tokens in memory, durable per-request
  revocation, compare-and-swap refresh locks and logout race protection.
- Buyer verified-account purchase/order/review gates; staff resource allowlist,
  current membership/shop status enforcement; owner-only payout/business paths.
- Payout destinations immutable after setup; automatic payouts remain off.
  First-payout ownership verification and sensitive-action step-up still needed.
- Distributed Durable Object rate limits, Turnstile wiring, hashed one-use
  email verification, fail-closed production transactional mail, outbox idempotency.
- Admin signed Access assertion verification and same-origin Pages proxy local.
- Same-origin WorkOS sign-in via Worker zone routes (Pages proxies retired, see review).

Latest changes in this continuation (not deployed):

1. apps/api/wrangler.toml custom storefront/vendor and same-origin WorkOS URLs;
   WORKOS_ENABLED explicitly 0. Production client ID not yet wired there.
2. scripts/deploy-pages.sh defaults use custom domains, refuses dirty tree,
   removes --commit-dirty=true. Do not bypass this guard to release unrelated work.
3. Production CORS excludes localhost/retired Vercel hosts; exact custom domains
   and retained exact Pages aliases allowed. Extras remain explicit ALLOWED_ORIGINS.
4. apps/api/src/middleware/cors.test.ts covers exact origins, lookalike hosts,
   preview rejection, production localhost rejection and development allowance.

## Verified database state and remaining prerequisites

Supabase alkemart ref iyjkvqfyjffkafnokfvt, eu-west-1. Read-only migration ledger
query returned **50 recorded files**, pending only **0050_email_verification** and
**0051_workos_auth**. Neither applied by this continuation. Connection is private
.local/supabase-alkemart.env; developer connection reaches live data.
Use repository runner scripts/apply-migrations.ts (bun run db:migrate), not
supabase db push or Drizzle journal. Re-read complete schema_migrations ledger
and compare all filenames before running. Prior 0036–0049 release backup existed,
but a fresh verified backup/restore check for this cutover is still required.
pg_dump/pg_restore were not found on PATH during latest preflight; arrange a
compatible runtime or Supabase CLI full schema+data backup, verify restoration.

Still missing/unverified: WORKOS_COOKIE_SECRET, production mail RESEND_API_KEY
and verified sender/domain, Turnstile secret/site keys and hostname restrictions,
deployed distributed abuse controls, exposed credential rotation/session
revocation, authenticated MFA and cross-account E2E, payment/refund/payout matrix.
Mail secrets were not supplied. No live money or production DB write performed.

## Ordered next steps

1. Review/isolate local security changes and dependency closure; identify the
   deployable commit without overwriting unrelated user changes. API/admin release
   should be coordinated and rollback versions recorded. Do not deploy all 1,500
   dirty changes. Check existing deployment IDs and bindings before mutation.
2. Inspect current WorkOS production settings/application and prepare exact
   client ID, encrypted-cookie secret (generate securely), session limits and
   auth email settings. Keep flags off. Confirm owner choice for email/password
   vs Google-only; legacy linking/recovery must remain viable. Vendor step-up is
   not satisfied by Google sign-in or verified email alone.
3. Configure transactional email with verified alkemart.com sender/DNS without
   disturbing MX/SPF. Test actual auth/recovery and order delivery; no log-only
   stub in production. Configure Turnstile exact hostnames and site keys in UI;
   test success, replay, expired and wrong-host challenges. Retrieve current
   provider schemas/docs before changing external config. No paid add-ons inferred.
4. Fresh schema+data backup, isolated restoration and rollback rehearsal. Inspect
   migrations 0050/0051, existing table compatibility and entire ledger; apply
   with repo runner through direct/session 5432, not transaction pooler 6543.
   Do not auto-verify legacy emails or claim old guest orders by email alone.
5. Deploy reviewed backend hardening first with WorkOS disabled; enforce signed
   Access on all admin routes, configure Durable Object bindings/limits, then
   deploy admin Pages proxy. Verify direct Worker AND custom API rejection for
   absent/forged Access assertions; test permitted/unpermitted Google identities
   and independent MFA. Preserve Access audience and preview protection.
6. Rotate exposed demo admin/vendor/buyer passwords through a trusted channel,
   stamp revocation and verify old sessions fail. Preserve new credentials in
   password manager, not docs. Do not use exposed credentials to test login.
   Stock-out demo script only after exact shop handles approved; no guessed shops.
7. Deploy storefront/vendor auth bridges and matching flags in a coordinated
   reviewed cutover with production key/client/cookie config. Inspect deployment
   script actually bundles Pages Functions. Run authenticated browser paths:
   Google callback, verified buyer checkout, existing-account link, vendor/staff,
   suspended vendor, cross-shop IDs, refresh races, logout/revocation, recovery,
   forged/replayed state and provider outage. No silent account creation/merging.
8. Run API/full domain regressions, money/stock concurrency and Paystack
   authenticity/replay tests. Live money tests require specific funded scenario
   approval; never create refunds/transfers just because owner said 'address all'.
   Keep automatic payouts off; use independently verified manual settlement
   pending step-up/review controls. Record accepted pilot restrictions explicitly.
9. Final live HTTPS/CORS/ready probes, cookie security, alias bypass checks,
   mail delivery evidence, migration history, deployed versions and rollback.
   Update release gates truthfully; no 'production ready' claim from unit tests alone.

## Verification already performed

- Earlier full API regression: 440 passed / 11 skipped, 79 files, using
  --maxWorkers=1 --testTimeout=20000 on loaded machine. Never uncap isolates.
- Latest CORS + admin Access: 12 tests passed across 2 files.
- API typecheck passed; bash -n scripts/deploy-pages.sh passed; dirty release
  guard refused before any build/deploy, as intended.
- Earlier storefront/vendor typechecks, 3 browser-session adapter tests,
  both Pages auth Function Wrangler builds and migration checks passed.
- Redirect tests: encoded path/query, HTTPS upgrade, port removal, unknown-host
  404; live www 308 confirmed. Final Pages statuses active.

Useful commands (from monorepo, no secrets inline):

```bash
cd apps/api
bun run typecheck
bun run test --maxWorkers=1 --testTimeout=20000
bunx wrangler secret list
# Reviewed release only: bunx wrangler deploy
# Root: bun scripts/check-migrations.ts
# Root: bun run deploy:pages (requires clean reviewed tree)
```

Do not run smoke/acid scripts against live production without reading their
write/payment behavior first. For UI changes use real click paths. No push,
production migration, paid service activation or money movement happened in this
continuation; remote mutations were domains/Access destinations, isolated redirect,
WorkOS callback/logout settings and the production WorkOS secret upload.
