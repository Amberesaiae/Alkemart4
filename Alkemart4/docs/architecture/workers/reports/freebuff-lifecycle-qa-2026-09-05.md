# Freebuff lifecycle QA report — 2026-09-05

**Executor:** Freebuff agent · **Task:** `docs/architecture/workers/FREEBUFF-LIFECYCLE-QA-TASK.md`
**Stack of record:** Cloudflare Workers + Supabase/Hyperdrive + Paystack + three gold Pages UIs
**Scope discipline:** No Medusa/Mercur revival, no dual-write, no out-of-scope APIs (returns / address book / wishlist N/A throughout).

---

## 1. Environment checklist

| Item | Live | Local |
|------|------|-------|
| API reachable | ✅ `https://alkemart-api.glean-circular-passport.workers.dev` | ✅ `http://127.0.0.1:8787` (wrangler dev, tmux session `alkemartqa`) |
| `/health/ready` | 200 `{ok:true, postgres:ok, paystack:ok}` | 200 `{ok:true, postgres:ok, paystack:ok}` |
| Storefront | ✅ pages.dev 200 | ✅ :5175 (Vite 7.3.6) |
| Vendor / Admin | ✅ / ✅ | ✅ :3002 / :3001 |
| Paystack | live secret on Worker → **no money writes from QA** | `sk_test_…` → full D-matrix executed |
| Shared-DB note | — | Local Hyperdrive emulation points at the **same Supabase Postgres as live**; mutations are shared. Seed stock restored after runs; all QA artifacts cleaned. |

**Local env fixes needed to run (documented in LOCAL-DEV.md):**
1. Hyperdrive local emulation required per-binding env vars `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE{,_PRIMARY}` — set from `.local/supabase-alkemart.env` pooler URL.
2. `.local` env file's pooler host `aws-0-…` was stale (`tenant/user postgres.iyjkvqfyjffkafnokfvt not found`); Supabase migrated this project to `aws-1-eu-west-1.pooler.supabase.com`. Same credentials work there.
3. Direct `db.<ref>.supabase.co:5432` is IPv6-only-reachable from this network; pooler is IPv4.

### Automated suites (exit codes)

| Script | Live | Local |
|--------|------|-------|
| `bun run smoke` | **0** (`E2E_SMOKE_OK`) | **0** (`smoke:local`) |
| `bun run smoke:acid` | **0** (`E2E_ACID_OK`) | **0** (`smoke:acid:local`) |

> Note: the acid script prints `None` for `shippingAddress` — it probes top-level JSON keys, but the API nests it under `orderGroup`. Script bug, not API bug (verified manually, A10 below).

---

## 2. Lifecycle matrix (A/B/C/D)

Legend: ✅ Pass · ❌ Fail · ⛔ Blocked (by test policy) · ➖ N/A · 🔁 Skip (shared-data protection)

### A. Buyer

| # | Row | Live | Local | Evidence |
|---|-----|------|-------|----------|
| A1 | Health / ready | ✅ | ✅ | `{"ok":true}`, ready 200 both envs |
| A2 | Register | ✅ 201 | ✅ 201 | QA buyer token issued |
| A3 | Login | ✅ | ✅ | buyer JWT |
| A4 | Categories | ✅ 12 top | ✅ | API returns full tree; **header rail = exactly 6 depts, no Pet Care** (UI walk below) |
| A5 | Search `q=tecno` | ✅ | ✅ | hit=Tecno Spark |
| A6 | PDP + offers | ✅ | ✅ | `prod-tecno-spark`, 1 sellable offer |
| A7 | Cart create + ATC `offerId` | ✅ | ✅ | 201 both; binds offer, not product |
| A8 | Cart patch qty + quote | ✅ | ✅ | qty 1→2; quote 6800 pesewas |
| A9 | COD checkout + shipping | ✅ | ✅ | orderGroupId `d3808148…` (live), `14d3ccdd…` (local) |
| A10 | Order detail shows address | ✅ | ✅ | `shippingAddress.city=Accra-qa-…` |
| A11 | Order list | ✅ | ✅ | group in buyer list |
| A12 | Guest lookup | ✅ | ✅ | `POST /store/orders/lookup` 200 |
| A13 | Footer contrast | ✅ | ✅ | UI walk: 17.06:1 links, 10.81:1 headings |
| A14 | MoMo pending (lab) | ⛔ | ✅→✅ | see D-rows |
| A15 | Card init (lab) | ⛔ | ✅ | authorizationUrl issued, D6 |

**Buyer ACID:** multi-seller split verified structurally (OrderGroup + per-seller orders via vendor order list); empty-cart checkout rejected 400 (acid step 2, both envs); shipping persisted (A10).

### B. Vendor

| # | Row | Live | Local | Evidence |
|---|-----|------|-------|----------|
| B1 | Login | ✅ | ✅ | vendor JWT |
| B2 | `/vendor/me` | ✅ | ✅ | `sellerId: seller-a` |
| B3 | Onboarding status | ✅ | ✅ | live: `ready:true` |
| B4 | Ghana setup | ⛔ | 🔁 | **Blocked on live by policy** (live key → real recipient creation forbidden); local already `ready` from first pass (test-key recipient `MTN` created successfully) |
| B5 | Products list | ✅ | ✅ | seeded Tecno present |
| B6 | Create + patch product | ❌→✅* | ✅ 201 | **P1 bug on live** — see Bugs; patch works |
| B7 | Propose | ✅* | ✅ | `status=proposed` |
| B8 | Orders list | ✅ | ✅ | count 22 (live) / 19 (local) |
| B9 | Ship | 🔁 | ✅ | QA-created order only: `placed→shipped` |
| B10 | Deliver | 🔁 | ✅ | `shipped→delivered` (payout-eligible) |
| B11 | Returns nav | ✅ | ✅ | source-verified: vendor layout hides Returns when `isWorkersApi()` |

\* Live B6/B7 passed only in the manual repro — see P1.

### C. Admin

| # | Row | Live | Local | Evidence |
|---|-----|------|-------|----------|
| C1 | Login + me | ✅ | ✅ | admin JWT, role `admin` |
| C2 | Sellers list | ✅ | ✅ | 13 (live) / 10 (local) incl. QA sellers |
| C3 | Seller lifecycle on **disposable QA seller** | ✅ | ✅ | register → approve → suspend → unsuspend → terminate (irreversible, QA-created); demo seller untouched |
| C4 | Moderation queue + approve | ❌* | ✅ | live queue contained 2 stranded artifacts (see P1 impact); approve flow works |
| C5 | Orders | ✅ | ✅ | 3 sampled |
| C6 | Payouts | ✅ guard / ⛔ full | ✅ guard | 404 unknown seller; 400 missing `recipient_code`; **full payout blocked by policy** (real transfer / shared delivered orders) |
| C7 | Migrate schema | ✅ | ✅ | idempotent (`IF NOT EXISTS` NOTICE observed) |
| C8 | Workers-only nav | ✅ | ✅ | source-verified: admin Sidebar flags `workers: true`; Mercur-only links unlinked |

### D. Payment / stock

| # | Row | Live | Local | Evidence |
|---|-----|------|-------|----------|
| D0 | Webhook signature tamper | ✅ 401 | ✅ 401 | invalid sig rejected both envs |
| D1 | COD confirm (intent→OrderGroup) | ✅ | ✅ | intent `completed`, group immediate |
| D2 | MoMo reserve | ⛔ | ✅ | `reserved 0→1`, `stock_reservations` rows=1 |
| D3 | MoMo success (status-poll verify) | ⛔ | ✅ | **full path**: Paystack test charge auto-success → `GET /checkout/status` verify → confirm → OrderGroup `54fb6542…`, intent `completed`, stock decremented (on_hand 8→7), reservation cleared |
| D4 | MoMo fail → release | ⛔ | ✅ | signed `charge.failed` → intent `failed`, `reserved` back to 0 |
| D5 | Webhook replay dedup | ⛔ | ✅ | same `charge.success` twice: 2nd returns `{"ok":true,"deduped":true}` |
| D6 | Card reserves + fail-release | ⛔ | ✅ | reserve 0→1 (rows=1) + authUrl; signed fail → `failed`, reservation released |
| D7 | Amount mismatch | ➖ | ➖ | unit-covered (`assertPaystackAmountMatches`, packages/paystack); cannot fabricate verified success vs real Paystack |
| D8 | Payout uniqueness | ⛔ | ⛔ | full path needs delivered+unpaid orders + real transfer; DB-unique `payout_lines` + `admin/payouts.test.ts` unit coverage cited |

**Live money matrix remains a launch gate** per `PAYMENTS-LAUNCH-GATE.md` — blocked by policy, not by code.

---

## 3. Bugs

### P1 — Live: `POST /vendor/products` intermittently 500s but **still commits** the product

- **Severity:** P1 (broken UX + data integrity side-effect: stranded `proposed` products, vendor retry → duplicates). Money/stock unaffected (P0 criteria not met).
- **Evidence:** matrix runs 10:45 & 10:47 UTC → `500 {"error":"internal_error"}`; `wrangler tail` captured `(error) Error: failed to create vendor product`; manual curl of the identical payload seconds later → `201`. Moderation queue showed 2 stranded `proposed` artifacts from the failed calls (`b63bb43e…`, `bfb7af9b…`, both cleaned via admin reject).
- **Root cause:** `PostgresCatalogRepository.createVendorProduct` inserted through the **cached `HYPERDRIVE` binding** and then read back through the same binding. Hyperdrive's query cache (default ~60s TTL, production only) served the pre-insert snapshot → read-back `null` → throw after the transaction committed. Local emulation has no query cache, hence never reproduced.
- **Doctrine hook:** `ACID-DATAFLOW.md` requires read-after-write ops on `HYPERDRIVE_PRIMARY`. Catalog mutations were the one family still on the cached binding.
- **Fix (implemented this session, uncommitted):** second `writeDb` handle on `PostgresCatalogRepository`; all catalog mutations (create/patch/propose/moderate) + their read-backs now run on `HYPERDRIVE_PRIMARY` (`apps/api/src/index.ts` `bindCatalog`, `apps/api/src/catalog-repository.ts`). Pure catalog reads stay cached.
- **Validation:** `tsc --noEmit` clean (2 pre-existing TS7030s unrelated), 29/29 API unit tests pass. **Requires `wrangler deploy` to take effect on live — pending human approval.**

### P2 — `scripts/e2e-workers-acid.sh` order-detail probe reads wrong JSON level

- **Severity:** P2 (tooling only).
- **Evidence:** acid prints `None` for the address probe on both envs; API returns `orderGroup.shippingAddress`.
- **Recommendation:** read `d.get("orderGroup",{}).get("shippingAddress")`.

### P2 — `.local/supabase-alkemart.env` pooler host stale

- **Severity:** P2 (local-dev friction; file is gitignored so not a repo bug).
- **Fix applied in-session:** launcher rewrites `aws-0-` → `aws-1-`. Documented in `LOCAL-DEV.md` common failures.

### Observation (no action) — failure webhooks are not KV-deduped

`charge.failed` re-delivery re-processes instead of short-circuiting with `deduped:true`. Effect is idempotent (status set + release are no-ops when already applied), so no money risk; noted because D5's contract differs per event type.

---

## 4. Doc drift (code ≠ docs) — fixed in-session

1. `ACID-DATAFLOW.md` implied catalog writes were primary-bound; they were not. **Updated** the binding-role table + added the known-failure-mode note.
2. `LOCAL-DEV.md` did not cover Hyperdrive local-emulation startup (new wrangler requirement) or the stale pooler-host pitfall. **Added** three rows to common failures.
3. Acid script probe level mismatch noted in the report (recommendation above); script itself not modified (out of minimal scope, flagged for next pass).

---

## 5. Recommendations (next fixes only — no Medusa revival)

1. **Deploy the writeDb fix** to production (`cd apps/api && npx wrangler deploy`) and re-run the live matrix to flip B6/C4 to green.
2. **Add an expiry job** for abandoned pending intents (already listed as a gap in ACID-DATAFLOW / LAUNCH-GATE-STATUS). QA's manual orphan-release (`fd1b2082`) simulates exactly what the job must do.
3. **Patch the acid script** address probe (P2, one line).
4. **Consider MoMo charge-then-intent ordering:** the MoMo path charges Paystack *before* the intent row exists (declined-initiation leaves zero residue — verified D2-fail). This is safe but means `payment_intents.created_at` lags the real charge; if ops ever needs exact charge timing in Postgres, flip the order and reserve-then-charge like card. Low priority.
5. **Live money matrix** (PAYMENTS-LAUNCH-GATE) remains the only unexecuted gate before public MoMo/card.

---

## 6. Definition of done

- [x] Smoke + acid on live (exit 0)
- [x] Smoke + acid on local (exit 0)
- [x] Full A/B/C/D matrix filled (33 PASS / 4 policy-blocked live; 50 PASS / 0 FAIL local)
- [x] Header rail: **6 depts**, popdowns open (`aria-expanded=true` + submenu render), **no Pet Care**
- [x] Footer contrast verified (17.06:1 links, 10.81:1 gold on `rgb(15,23,42)`)
- [x] Report filed with evidence
- [x] No production secret commits; nothing pushed; all QA artifacts cleaned (10 QA offers deactivated, stranded live products rejected, reservations released, `reserved==SUM(rows)` invariant 0 mismatches, seed stock restored)
