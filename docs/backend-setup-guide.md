# Backend Setup Guide (Dual Environment SDLC)

## 0) Target Architecture
Implement two resource sets with one codebase:
- `Development`: isolated resources (DB, Blob, OAuth client)
- `Preview` + `Production`: shared resources

This repository keeps the same env var names in code. Isolation is done by Vercel environment scoping.

---

## 1) Environment Matrix (Authoritative)
Use the matrix in:
- `docs/environment-matrix.md`

Required vars:
- `APP_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SESSION_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BLOB_READ_WRITE_TOKEN`
- `ANALYTICS_INGEST_SECRET`
- `CRON_SECRET`

---

## 2) Turso Setup (Two Databases)
Create two Turso databases and tokens:
- Dev DB (example: `best-hiit-portal-dev`)
- Prod/Preview DB (example: `best-hiit-portal-prod`)

Commands:
```bash
turso auth login
turso db create best-hiit-portal-dev
turso db create best-hiit-portal-prod

turso db show best-hiit-portal-dev
turso db show best-hiit-portal-prod

turso db tokens create best-hiit-portal-dev
turso db tokens create best-hiit-portal-prod
```

Map values:
- `Development` -> dev DB URL/token
- `Preview` + `Production` -> prod DB URL/token

### Recreate `nodoubt-analytics` table set in both new DBs
This repo includes canonical schema SQL at:
- `docs/turso-schema.sql`

Apply it to each DB:
```bash
turso db shell best-hiit-portal-dev < docs/turso-schema.sql
turso db shell best-hiit-portal-prod < docs/turso-schema.sql
```

Verify table presence:
```bash
turso db shell best-hiit-portal-dev \".tables\"
turso db shell best-hiit-portal-prod \".tables\"
```
Expected tables include:
- `coach_tenants`
- `coach_templates`
- `coach_social_links`
- `analytics_events`
- `analytics_rollup_daily`
- `content_jobs`

Compatibility note:
- If `coach_tenants.coach_header_image_url` is not present in the imported schema, the current API bootstrap logic adds it automatically on first authenticated API use.

### Seed workspace row in each DB
The portal requires matching `owner_google_sub` in `coach_tenants`.

Run SQL in each DB shell:
```sql
INSERT INTO coach_tenants (
  id,
  slug,
  owner_google_sub,
  owner_email,
  business_name,
  coach_name,
  bio,
  logo_url,
  coach_photo_url,
  coach_header_image_url,
  qr_code_url,
  theme_primary_color,
  theme_secondary_color,
  brand_headline,
  status,
  created_at,
  updated_at
) VALUES (
  'tenant_env_01',
  'tenant-slug-here',
  'GOOGLE_SUB_HERE',
  'coach@email.com',
  'Business Name',
  'Coach Name',
  '',
  '',
  '',
  '',
  '',
  '#f97316',
  '#111827',
  '',
  'draft',
  '2026-05-05T00:00:00.000Z',
  '2026-05-05T00:00:00.000Z'
);
```

---

## 3) Google OAuth Setup (Two Clients)
Create two web OAuth clients:
- `best-hiit-timer-portal-dev`
- `best-hiit-timer-portal-prod-preview`

### Redirect URI policy
- Dev client: dev callback URL only
- Prod/Preview client: stable callback URL only (shared by Preview and Production)

Callback format:
- `<APP_BASE_URL>/api/auth/callback`

Important:
- Google does not support wildcard callback URLs.
- Do not rely on dynamic preview URL callbacks.

---

## 4) Vercel Blob Setup (Two Stores/Tokens)
Provision:
- Blob resource for Development
- Blob resource for Preview/Production

Map values:
- `Development` -> dev `BLOB_READ_WRITE_TOKEN`
- `Preview` + `Production` -> prod `BLOB_READ_WRITE_TOKEN`

---

## 5) Vercel Environment Variable Scoping
In Vercel project settings, set each required variable in all three scopes:
- `Development`
- `Preview`
- `Production`

Rules:
- Preview and Production must use identical values in this SDLC model.
- Development must use separate values.

After changes, redeploy affected environments.

---

## 6) Cron and Secrets
Rollup endpoint expects:
- `Authorization: Bearer <CRON_SECRET>`

Set `CRON_SECRET` in `Production` and `Preview`.
Set in `Development` only if you run rollup there.

Analytics ingest secret:
- `ANALYTICS_INGEST_SECRET` should be unique per resource set.

Session secret:
- `AUTH_SESSION_SECRET` should differ between Development and Preview/Production.

---

## 7) Verification Checklist
Run in `Development`:
1. Sign in with dev OAuth client.
2. Upload branding asset and save branding.
3. Confirm asset URL resolves and data persists in dev DB.
4. Ingest event + run rollup; verify dev analytics data updates.

Run in `Preview`:
1. Sign in using prod-preview OAuth client.
2. Save/update branding and template.
3. Confirm DB writes appear in prod-preview DB.
4. Confirm Blob writes use prod-preview token/store.

Run in `Production`:
1. Validate auth callback and `/api/auth/me`.
2. Validate branding/template read-write.
3. Validate scheduled rollup with `CRON_SECRET`.

---

## 8) Failure Map
- `401` on OAuth callback:
  - Wrong `APP_BASE_URL` for the selected environment, or wrong OAuth client redirect URI.
- `500` DB failures:
  - Wrong `TURSO_DATABASE_URL` or `TURSO_AUTH_TOKEN` for that Vercel scope.
- Asset errors:
  - Missing/incorrect `BLOB_READ_WRITE_TOKEN` in that Vercel scope.
- `403 No workspace linked`:
  - Missing `coach_tenants` row for the user sub in that environment DB.
- Rollup `401`:
  - Missing or mismatched `CRON_SECRET` for the environment.
