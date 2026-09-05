# Rollback — Workers

Railway/Neon PITR notes archived under `archive/docs-medusa-era/ops/rollback.md`.

## API

```bash
cd apps/api
npx wrangler deployments list
npx wrangler rollback
```

Or redeploy a known-good git SHA:

```bash
git checkout <sha>
cd apps/api && npx wrangler deploy
```

## Pages

Redeploy previous build artifact / prior commit with the same `VITE_ALKEMART_API_URL`.

## Database

- Prefer forward-fix migrations.  
- Supabase dashboard → backups / PITR for destructive data incidents.  
- Admin migrate one-shots are additive (`IF NOT EXISTS`) — safe to re-run.

## Payments

- Do not replay webhooks blindly against a rolled-back DB.  
- After rollback, verify `/health/ready` and run `./scripts/e2e-workers-smoke.sh`.  
- Check Paystack dashboard for orphan charges if a deploy mid-checkout failed.
