# Frontend + Postgres cutover runbook

Production uses **Postgres** (`DATABASE_URL` / SQLAlchemy). Compose serves `app/frontend` on port **3001**.

## Pre-cutover inventory (read-only)

Point `DATABASE_URL` at production (or a dump restore) and run:

```bash
docker compose exec backend python -m scripts.inventory_db
```

Confirm:

- Tables/columns vs current models (`organizations`, `branches`, `orders`, `organization_id` on users/quotes/invoices)
- Row counts for users, quotes, quote_items, invoices, products, categories, training, contact, newsletter, site_settings, email_logs
- `needs_legacy_user_migrate` / `users_without_org` / `customer_role_count`

### Local baseline (dev DB, 2026-10-05)

| Metric | Value |
|--------|-------|
| Tables | 35 / 35 expected |
| users | 37 |
| organizations | 22 |
| branches | 27 |
| quotes / quote_items | 58 / 155 |
| invoices / invoice_items | 21 / 61 |
| orders | 22 |
| products / categories | 280 / 13 |
| contact / newsletter | 25 / 21 |
| users_without_org (facility roles) | 0 after migrate |
| sales/admin without org | expected (company staff) |
| unassigned quotes (no user) | 4 (admin drafts; non-blocking) |
| customer role | 0 |

Re-run inventory on the **production** dump before and after migration; do not treat local counts as prod.

## Staging migration

1. Dump production Postgres; restore into a staging database.
2. Set `DATABASE_URL` to the staging clone. Keep the production `SECRET_KEY` so password hashes / JWTs remain valid.
3. Dry-run inventory:

   ```bash
   docker compose exec backend python -m scripts.migrate_prod_to_v2 --dry-run
   ```

4. Apply forward migration (SQL `001`–`021` via `init_db`, `migrate_legacy_users`, catalog IDs, document refs, gap-fill):

   ```bash
   docker compose exec backend python -m scripts.migrate_prod_to_v2
   ```

5. Exit code `0` = no orphans. Exit code `2` = remaining users/quotes/invoices without org — investigate before go-live.

## Production cutover

1. Maintenance window; stop writes (scale down API/frontend or enable maintenance).
2. Final `pg_dump` of production; keep the file for rollback.
3. Either migrate **in place** or restore the dump to the target DB, then run `python -m scripts.migrate_prod_to_v2`.
4. Deploy backend + single `frontend` service (built from `app/frontend`, port 3001).
5. Env checks:
   - `FRONTEND_URL` = public site origin (port 3001 locally)
   - `CORS_ORIGINS` = same origin(s) only
   - `REACT_APP_BACKEND_URL` build arg = public API URL
   - PDF assets mount: `./app/frontend/public` → `/app/assets`
6. Point domain/DNS at the frontend service (still port 3001 if that was public before).
7. Keep the dump until post-cutover verification passes.

## Verification checklist

- [ ] `python -m scripts.inventory_db` — schema ready, facility orphans = 0
- [ ] Admin `/sysadmin` login
- [ ] Facility login lands on facility dashboard (`org_admin`)
- [ ] Products/categories counts match pre-migration inventory
- [ ] Quotes/invoices linked to organizations; PDF download shows Hampton logo
- [ ] Site settings / newsletter / contact inquiries preserved
- [ ] SMTP still works with production `.env`

### Local cutover verification (2026-10-05)

| Check | Result |
|-------|--------|
| Compose services | `backend`, `frontend`, `postgres` only |
| `http://localhost:3001` | HTTP 200 |
| `/api/health` | `healthy` / `postgres` |
| Admin password verify (`admin@hamptonscientific.com`) | OK |
| Facility org_admin + password (`amina.wanjiku@…`) | OK (`organization_id` set) |
| Catalog counts | products 280 / categories 13 |
| Quotes/invoices with org | 54 / 21 (4 unassigned admin draft quotes) |
| PDF assets mount | `/app/assets/hampton-logo.png` + `paid-stamp.webp` present |
| `migrate_prod_to_v2` | exit 0 |

## Rollback

1. Stop new stack writes.
2. Restore the pre-migration `pg_dump`.
3. Redeploy previous backend + frontend images if needed.
4. Do **not** re-run migrate against the restored dump unless intentionally re-attempting cutover.

## Compose service map (after cutover)

| Service | Source | Host port |
|---------|--------|-----------|
| backend | `./app/backend` | 8001 |
| frontend | `./app/frontend` | 3001 |
| postgres | `postgres:16-alpine` | 5433 → 5432 |
