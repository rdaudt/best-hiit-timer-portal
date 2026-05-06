# Environment Matrix

This app uses one codebase with environment-specific resource values in Vercel.

## Resource Topology
- `Development` environment:
  - Dedicated Turso database
  - Dedicated Vercel Blob store/token
  - Dedicated Google OAuth client
- `Preview` + `Production` environments:
  - Shared Turso database
  - Shared Vercel Blob store/token
  - Shared Google OAuth client (stable callback domain)

## Variable Scoping Matrix
Set the same variable names in all Vercel scopes, but with different values:

- `APP_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SESSION_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BLOB_READ_WRITE_TOKEN`
- `ANALYTICS_INGEST_SECRET`
- `CRON_SECRET`

Recommended mapping:

| Variable | Development | Preview | Production |
|---|---|---|---|
| `APP_BASE_URL` | dev base URL | stable prod/preview auth domain | stable prod/preview auth domain |
| `GOOGLE_CLIENT_ID` | dev OAuth client id | prod-preview OAuth client id | prod-preview OAuth client id |
| `GOOGLE_CLIENT_SECRET` | dev OAuth client secret | prod-preview OAuth client secret | prod-preview OAuth client secret |
| `AUTH_SESSION_SECRET` | dev secret | prod-preview secret | prod-preview secret |
| `TURSO_DATABASE_URL` | dev DB URL | prod-preview DB URL | prod-preview DB URL |
| `TURSO_AUTH_TOKEN` | dev DB token | prod-preview DB token | prod-preview DB token |
| `BLOB_READ_WRITE_TOKEN` | dev blob token | prod-preview blob token | prod-preview blob token |
| `ANALYTICS_INGEST_SECRET` | dev ingest secret | prod-preview ingest secret | prod-preview ingest secret |
| `CRON_SECRET` | optional dev cron secret | prod-preview cron secret | prod-preview cron secret |

## Notes
- Preview intentionally shares data with production in this model.
- Never reuse development DB/blob/oauth credentials in Preview/Production.
- Keep seeded test tenants and user accounts separate between Development and Preview/Production.
