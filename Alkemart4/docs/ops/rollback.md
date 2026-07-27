# Rollback Runbook

## Railway Deploy Rollback

```bash
# List recent deployments
railway deploy --list

# Rollback to a specific deployment
railway rollback <deployment-id>

# If Railway CLI is unavailable, use the dashboard:
# 1. Go to https://railway.app/project/8e3b8293-9aee-48f9-a999-aa69ded1c1e9
# 2. Select the alkemart-api service
# 3. Click "Deployments"
# 4. Find the working deployment
# 5. Click "Rollback to this deploy"
```

## Database Rollback (Neon)

```bash
# Neon has built-in PITR. To restore:
# 1. Go to Neon console → Branches → select your branch
# 2. Click "Restore" and choose the point in time
# 3. Or use CLI:
railway run -- psql "$DATABASE_URL" -c "SELECT pg_backup_start('manual_pre_deploy');"
```

## Rollback Procedure

1. **Assess** — determine if the issue is code, data, or config
2. **Code rollback** — use Railway rollback (above); DB schema is backward-compatible
3. **Data rollback** — if bad data was written, restore from Neon PITR
4. **Verify** — check `/health` endpoint, run `smoke:ui` tests
5. **Communicate** — post in #incidents with before/after timestamps
