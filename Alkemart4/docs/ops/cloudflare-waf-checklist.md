# Cloudflare WAF / rate-limit checklist (public pilot)

Worker middleware rate limits are **best-effort per isolate** — not a substitute for edge rules. Apply these in the Cloudflare dashboard before public traffic.

## Scope

| Hostname / service | Notes |
|--------------------|-------|
| `alkemart-api.*.workers.dev` (and custom API host if any) | Auth, checkout, hooks |
| `alkemart4-storefront.pages.dev` (+ custom shop host) | Public UI |
| Vendor / admin Pages | Prefer Access or IP allowlist if still lab-only |

## Minimum rules

1. **Rate limiting** (Security → WAF → Rate limiting rules), separate rules:
   - `http.request.uri.path contains "/store/auth"` — ~20 req / 1 min / IP  
   - `http.request.uri.path eq "/store/checkout"` — ~10 req / 1 min / IP  
   - `http.request.uri.path contains "/hooks/paystack"` — higher (Paystack retries); still capped (~120 / min / IP)  
   - `http.request.uri.path eq "/store/orders/lookup"` — ~20 req / 1 min / IP  
2. **Managed ruleset**: enable Cloudflare Free Managed Ruleset (or OWASP if on Paid).  
3. **Bot Fight Mode** (Free) or Super Bot Fight Mode (Paid) on storefront + API.  
4. **Challenge** on `/admin/*` and `/vendor/auth/*` if those hosts are public (or put admin/vendor behind Cloudflare Access).

## Demo accounts

After WAF is on, rotate lab passwords:

```bash
curl -X POST "$API/admin/migrate/rotate-demo-passwords" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H 'content-type: application/json' \
  -d '{"adminPassword":"…","vendorPassword":"…","buyerPassword":"…"}'
```

Update `docs/DEMO-ACCOUNTS.md` and CI secrets. Do not commit real production passwords.

## Expiry job (Free cron workaround)

If Workers Free already has 5 cron triggers (deploy error 10072), schedule an external hourly call:

```bash
curl -X POST "$API/admin/migrate/expire-payment-intents" \
  -H "Authorization: Bearer $ADMIN_JWT"
```

Prefer restoring a native cron slot or Workers Paid so `[triggers]` in `apps/api/wrangler.toml` applies.
