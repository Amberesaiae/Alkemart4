# CORS and `ALLOWED_ORIGINS`

Middleware: `apps/api/src/middleware/cors.ts`.

## Defaults (always allowed)

Local Vite ports (`5175`–`5177`, `3001`–`3002`) and production Pages:

- `https://alkemart4-storefront.pages.dev`
- `https://alkemart4-vendor.pages.dev`
- `https://alkemart4-admin.pages.dev`

Legacy Vercel hostnames remain in the allowlist for transition only.

## Extra origins

Set Worker var / secret-style var:

```bash
cd apps/api
npx wrangler secret put ALLOWED_ORIGINS
# value: https://shop.example.com,https://vendor.example.com,https://admin.example.com
```

Or `[vars]` in `wrangler.toml` for non-secret lists (prefer dashboard/vars for custom domains).

Comma-separated, trimmed. Credentials mode: `Access-Control-Allow-Credentials: true` when origin matches.

## Custom domains checklist

1. Attach custom domains on each Pages project.  
2. Add those origins to `ALLOWED_ORIGINS`.  
3. Redeploy Worker (or update var) and hard-refresh UIs.  
4. Confirm a credentialed `POST /store/auth/login` from the custom origin succeeds (no CORS error in browser).  
5. Cloudflare WAF / rate limiting on the Worker hostname for public launch.
