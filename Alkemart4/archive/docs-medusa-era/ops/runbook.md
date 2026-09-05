# Operations Runbook

## Quick Reference

| Task | Command |
|------|---------|
| Check service status | `railway environment status` |
| View deploy logs | `railway get-logs --log-type build` |
| View app logs | `railway get-logs --log-type deploy` |
| View HTTP logs | `railway get-logs --log-type http` |
| List deployments | `railway deployment list` |
| Rollback | `railway rollback <deployment-id>` |
| Set env vars | `railway variables set KEY=VALUE` |
| View env vars | `railway variables list` |

## Logs

### Build Logs

Check build failures:

```bash
railway get-logs --log-type build
railway get-logs --log-type build --level error
```

Common build failures:
- **Module not found**: Add missing deps to `apps/backend/package.json` (see AGENTS.md)
- **Rollup resolution errors**: Radix/sonner/tailwindcss-animate need hoisting
- **TypeScript errors in CI**: Run `tsc --noEmit` locally first

### Deploy (Runtime) Logs

```bash
# Last 100 lines
railway get-logs --log-type deploy

# Errors only
railway get-logs --log-type deploy --level error

# Search for specific text
railway get-logs --log-type deploy --search "Error:"

# Last 1 hour
railway get-logs --log-type deploy --since 1h
```

### HTTP Logs

```bash
# Recent requests
railway get-logs --log-type http

# 5xx errors
railway get-logs --log-type http --status ">=500"

# Specific endpoint
railway get-logs --log-type http --path "/store/products"
```

## Common Tasks

### 1. Check Service Health

```bash
railway environment status
```

Expected output: all services should show "healthy" or "running".

Direct health check:
```bash
curl -s https://alkemart-api-production.up.railway.app/health | jq .
```

### 2. Database: View Connection Pool

```bash
railway run -- psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity;"
```

### 3. Database: List Recent Orders

```bash
railway run -- psql "$DATABASE_URL" -c "SELECT id, display_id, status, created_at FROM \"order\" ORDER BY created_at DESC LIMIT 10;"
```

### 4. View Sentry Errors

Open the [Sentry dashboard](https://alkemart.sentry.io) or check recent errors:

```bash
# Install sentry-cli if needed
sentry-cli --auth-token "$SENTRY_AUTH_TOKEN" events list --project alkemart --limit 10
```

### 5. Restart a Service

```bash
railway service restart
```

### 6. Scale Service

```bash
# Set replicas per region
railway scale-service --replicas '{"us-west": 1, "eu-west": 1}'
```

## Incident Response

### Tier 1 — Service Down

1. Check Railway status: `railway environment status`
2. Check deploy logs: `railway get-logs --log-type deploy --level error`
3. Check Neon status: https://neonstatus.com
4. If recent deploy, rollback: see [rollback.md](./rollback.md)
5. If DB issue, check `railway run -- psql "$DATABASE_URL" -c "SELECT 1;"`

### Tier 2 — High Error Rate

1. Check HTTP logs: `railway get-logs --log-type http --status ">=500"`
2. Check Sentry for new issues
3. Check [error rate](https://railway.app/project/8e3b8293-9aee-48f9-a999-aa69ded1c1e9/observability)
4. If payment errors, verify Paystack webhook IPs

### Tier 3 — Performance Degradation

1. Check response times: `railway http-response-time`
2. Check CPU/Memory: `railway service-metrics`
3. Check DB query performance (Neon console)
4. Consider scaling: `railway scale-service --replicas '{"us-west": 2}'`

## Maintenance

### Deploy New Version

```bash
railway deploy --message "chore: deploy $(git rev-parse --short HEAD)"
```

### Update Environment Variables

```bash
# Add or update
railway variables set KEY=VALUE

# Reference another service
railway variables set DATABASE_URL='${{Postgres.DATABASE_URL}}'
```

### Clear Redis Cache

```bash
railway run -- redis-cli -u "$REDIS_URL" FLUSHALL
```
