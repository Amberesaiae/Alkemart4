# Monitoring — Workers

Medusa/Railway monitoring notes archived under `archive/docs-medusa-era/root/monitoring.md`.

## Endpoints to probe

| URL | Expect |
|-----|--------|
| `https://alkemart-api…workers.dev/health` | `ok` |
| `https://alkemart-api…workers.dev/health/ready` | postgres ok; paystack ok or degraded |
| `https://alkemart4-storefront.pages.dev` | 200 |
| `https://alkemart4-vendor.pages.dev` | 200 |
| `https://alkemart4-admin.pages.dev` | 200 |

## Suggested alerts

- Worker 5xx rate  
- Ready probe failure (Postgres)  
- Paystack webhook signature failures (logs)  
- Pages deploy / origin down  

Wire your preferred uptime tool (Better Stack, Checkly, Cloudflare Health Checks) to the table above.
