# Uptime & Production Monitoring

## Why

No monitoring means you discover outages when a customer complains (or never). These recommendations close that gap at minimal cost.

## Recommended Stack

| Tier | Tool | Cost | Covers |
|------|------|------|--------|
| Uptime | Better Uptime (betteruptime.com) | Free (10 monitors) | HTTP checks, SSL expiry, status page |
| Errors | Sentry | Free (5k events/mo) | JS exceptions, API 5xx, source maps |
| Performance | PostHog | Free (1M events/mo) | Core Web Vitals, page load, rage clicks |
| Logs | Railway Logs (built-in) | Free | Build + deploy logs, HTTP access logs |

## Setup Steps

### 1. Uptime Monitoring (Better Uptime — free)

Monitor these endpoints:

| Endpoint | Expected | Interval |
|----------|----------|----------|
| `GET https://alkemart-api-production.up.railway.app/health` | 200 + `ok` | 1 min |
| `GET https://alkemart.com` | 200 | 5 min |
| `GET https://alkemart.com/api/health` | 200 | 5 min |

Create a **status page** (free on Better Uptime) and point your domain's `/status` to it.

### 2. Error Tracking (Sentry — already configured)

Sentry DSN is already wired in the backend (`SENTRY_DSN` env var). Set it in Railway → Variables.

### 3. Performance Monitoring (PostHog — already configured)

PostHog is wired in the storefront. Create a dashboard for:
- Page load time (p50/p95)
- Core Web Vitals (LCP, CLS, INP)
- Error rate (% of pageviews with JS errors)

### 4. Alerting

- Better Uptime → Slack / Email (free tier includes both)
- Sentry → Slack via integration
- Railway → no native alerting; use Better Uptime as the primary alert channel

## Runbook: Common Failures

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Health check 503 | DB connection exhausted | `railway restart` — or check Neon pool limits |
| Health check 502 | Build failed / OOM | Check deploy logs; increase `resourceLimit` |
| Storefront blank page | API CORS or missing env var | `VITE_MEDUSA_BACKEND_URL` must be set & CORS must include storefront origin |
| Search broken | Meilisearch down / reindex needed | Check Meilisearch health; reindex via `POST /admin/search/reindex` |
| Images broken | S3 credentials expired / bucket policy changed | Check Tigris/B2 dashboard; verify `S3_*` env vars |

## When to Add More

- **Apdex / SLIs**: When traffic exceeds 10K req/day, add p99 latency + error budget alerts.
- **Synthetic transactions**: When checkout is a critical path, add Playwright scripts that buy a test product every 5 min.
- **Database metrics**: When Neon pool reaches 50% utilization, add Neon observability integration.
