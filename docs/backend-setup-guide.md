# Backend Setup Guide (Vercel + Turso + Google OAuth + Blob)

## 0) What this guide configures
You will set up:
- Google OAuth login for `/api/auth/*`
- Turso database connection and initial workspace row
- Vercel Blob uploads for branding assets
- Analytics ingest secret + daily rollup cron
- Vercel project env vars and deployment checks

---

## 0.1) New Vercel Project Context (Important)
This guide assumes you are creating a **new Vercel project/app** named `best-hiit-timer-portal`.

Because this is a new project:
- Environment variables must be created again in this new project.
- Blob storage must be attached/configured in this new project.
- Cron configuration applies to this new project only.
- `APP_BASE_URL` and Google OAuth redirect URI must point to this new app domain.

Use this as your default base URL unless you use a custom domain:
- `https://best-hiit-timer-portal.vercel.app`

---

## 1) Create a deployment values worksheet first
Create a local file (not committed) like `backend-setup-values.txt` and fill this table:

- `APP_BASE_URL` = `https://<your-production-domain>`
- `GOOGLE_CLIENT_ID` = from Google Cloud OAuth client
- `GOOGLE_CLIENT_SECRET` = from Google Cloud OAuth client
- `AUTH_SESSION_SECRET` = long random string
- `TURSO_DATABASE_URL` = from Turso database
- `TURSO_AUTH_TOKEN` = from Turso token
- `BLOB_READ_WRITE_TOKEN` = from Vercel Blob store
- `CRON_SECRET` = long random string
- `ANALYTICS_INGEST_SECRET` = long random string

Keep this file private.

---

## 2) Turso setup (database + token + seed row)
Use the existing shared Turso database used by the timer app:
- Database name: `nodoubt-analytics`
- Do not create a separate portal database.

### 2.1 Get `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
You can do this in Turso CLI (most reliable):

1. Install/login Turso CLI:
```bash
turso auth login
```
2. Select the existing shared DB:
```bash
turso db ls
```
3. Get DB URL:
```bash
turso db show nodoubt-analytics
```
Copy the LibSQL URL (`libsql://...`) as `TURSO_DATABASE_URL`.
4. Create token:
```bash
turso db tokens create nodoubt-analytics
```
Copy token as `TURSO_AUTH_TOKEN`.

### 2.2 Seed one coach workspace row (required)
Your portal blocks access unless `owner_google_sub` exists in `coach_tenants`.

Use Turso shell:
```bash
turso db shell nodoubt-analytics
```

Run this SQL (replace placeholders):
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
  qr_code_url,
  theme_primary_color,
  theme_secondary_color,
  brand_headline,
  status,
  created_at,
  updated_at
) VALUES (
  'tenant_nodoubt_01',
  'nodoubt-training',
  'GOOGLE_SUB_HERE',
  'coach@email.com',
  'NoDoubt Training Co.',
  'Coach Gabe',
  '',
  '',
  '',
  '',
  '#f97316',
  '#111827',
  '',
  'draft',
  '2026-05-04T00:00:00.000Z',
  '2026-05-04T00:00:00.000Z'
);
```

How to get `GOOGLE_SUB_HERE`:
- First deploy auth, login once, then call `/api/auth/me` in browser devtools network or direct endpoint while logged in and copy `sub`.

---

## 3) Google Cloud OAuth setup (exact UI steps)

### 3.1 Create project
1. Open Google Cloud Console.
2. Top bar project selector -> `New Project`.
3. Name it (example: `best-hiit-timer-portal`) -> `Create`.

### 3.2 Configure OAuth consent screen
1. Left menu -> `APIs & Services` -> `OAuth consent screen`.
2. User type: `External` (or Internal if Workspace-only).
3. Fill app name, support email, developer contact email.
4. Save.
5. Add scopes:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
6. Add test users if app is in testing mode.

### 3.3 Create OAuth client
1. `APIs & Services` -> `Credentials`.
2. `+ Create Credentials` -> `OAuth client ID`.
3. Application type: `Web application`.
4. Name: `best-hiit-timer-portal-prod`.
5. Authorized redirect URIs:
   - `https://best-hiit-timer-portal.vercel.app/api/auth/callback` (if using default Vercel domain)
   - and/or `https://<your-custom-domain>/api/auth/callback`
6. Create.
7. Copy:
   - Client ID -> `GOOGLE_CLIENT_ID`
   - Client secret -> `GOOGLE_CLIENT_SECRET`

Important: Google does not support wildcard callback URLs. Preview URLs won’t work unless explicitly added or you use a dedicated stable preview domain/client.

---

## 4) Vercel Blob setup (`BLOB_READ_WRITE_TOKEN`)

1. Open Vercel dashboard.
2. Select project `best-hiit-timer-portal` (**the new project**).
3. Go to `Storage` tab.
4. Create/attach a Blob store.
5. Open that Blob store details.
6. Create/read-write token.
7. Copy token to `BLOB_READ_WRITE_TOKEN` in this same project.

---

## 5) Generate secure secrets

Generate locally (PowerShell):
```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object {[byte]$_}))
```

Do this 3 times and set:
- `AUTH_SESSION_SECRET`
- `CRON_SECRET`
- `ANALYTICS_INGEST_SECRET`

---

## 6) Configure Vercel project env vars (exact UI steps)

1. Vercel dashboard -> project `best-hiit-timer-portal` (**new project**).
2. `Settings` -> `Environment Variables`.
3. Add each variable one by one:
   - `APP_BASE_URL` (for default domain: `https://best-hiit-timer-portal.vercel.app`)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `AUTH_SESSION_SECRET`
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `BLOB_READ_WRITE_TOKEN`
   - `CRON_SECRET`
   - `ANALYTICS_INGEST_SECRET`
4. Scope each to:
   - `Production` (required)
   - `Preview` only if your Google callback strategy supports preview
   - `Development` optional
5. Save all.
6. Trigger redeploy:
   - `Deployments` -> latest -> `...` -> `Redeploy`.

---

## 7) Cron setup for analytics rollup

Your endpoint: `/api/portal/analytics-rollup` expects header `Authorization: Bearer <CRON_SECRET>`.

### 7.1 Add schedule in `vercel.json`
Use:
```json
{
  "crons": [
    { "path": "/api/portal/analytics-rollup", "schedule": "0 3 * * *" }
  ]
}
```

### 7.2 Ensure auth header works
Vercel cron automatically sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` env exists in project. Keep `CRON_SECRET` set in Production.

### 7.3 Manual test
From terminal:
```bash
curl -i -X POST "https://best-hiit-timer-portal.vercel.app/api/portal/analytics-rollup" -H "Authorization: Bearer <CRON_SECRET>"
```
Expect `200` and JSON with `ok: true`.

---

## 8) Timer app integration requirements (for shared analytics)

Your timer app should call:
- `POST https://best-hiit-timer-portal.vercel.app/api/portal/analytics-ingest` (or your custom domain)

Body shape:
```json
{
  "tenantSlug": "nodoubt-training",
  "eventName": "timer_run_completed",
  "occurredAt": "2026-05-04T19:30:00.000Z",
  "payload": {
    "durationSec": 1200,
    "stationCount": 8,
    "roundsPerStation": 3,
    "workSec": 40,
    "restSec": 20
  }
}
```

Headers:
- `Content-Type: application/json`
- `Authorization: Bearer <ANALYTICS_INGEST_SECRET>` (recommended)

Allowed `eventName` in current backend:
- `app_opened`
- `timer_created`
- `timer_run_completed`
- `timer_run_incomplete`
- `timer_created_from_template`

---

## 9) Production smoke checklist (exact order)

1. Open `https://best-hiit-timer-portal.vercel.app/signin` (or custom domain).
2. Click Google login; complete consent.
3. Call `https://best-hiit-timer-portal.vercel.app/api/auth/me` in same browser session.
   - Must return `user.sub`, `user.email`, `user.workspaceSlug`.
4. Open portal `/branding`.
5. Upload a logo.
   - Saved URL path must include `tenants/<workspaceId>/...`.
6. Save branding, then publish branding.
7. Create template in `/templates/new`, then publish it.
8. Send one analytics ingest event (curl/postman).
9. Trigger rollup manually (curl).
10. Open dashboard and confirm metrics/trend are non-zero.

---

## 10) Common failure map

- `401` on `/api/auth/*` callback:
  - Wrong `APP_BASE_URL` or Google redirect URI mismatch.
- `403 No workspace linked`:
  - Missing `coach_tenants` row for `owner_google_sub`.
- `500` on DB endpoints:
  - Bad `TURSO_DATABASE_URL` or `TURSO_AUTH_TOKEN`.
- Asset save rejected (`TENANT_ASSET_FORBIDDEN`):
  - URL not from `tenants/<workspaceId>/...`.
- Rollup `401`:
  - Missing/wrong `CRON_SECRET`.
- No dashboard data:
  - Ingest not called, wrong `tenantSlug`, or rollup not run yet.


