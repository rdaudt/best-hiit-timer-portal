# Operations Runbook

## Environment Topology
- `Development` has isolated resources (Turso, Blob, OAuth client, secrets).
- `Preview` and `Production` share one resource set.
- Reference matrix: `docs/environment-matrix.md`.

## Required Environment Variables
- `APP_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SESSION_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BLOB_READ_WRITE_TOKEN`
- `ANALYTICS_INGEST_SECRET` (recommended)
- `CRON_SECRET`

## Security Controls Implemented
- Google OIDC callback verifies ID token signature using Google JWKS.
- All portal read/write APIs require authenticated session.
- Workspace authorization resolves from `owner_google_sub` server-side.
- Asset uploads are forced to tenant-prefixed blob paths.
- Branding rejects cross-tenant asset references.
- Analytics summary is coach-session scoped by tenant id.
- Analytics rollup endpoint is cron-secret protected.

## Coach Invite Codes (POC)
- Invites are managed directly in SQL only; there is no admin endpoint/UI.
- Codes are case-insensitive and trimmed before hashing.
- Only hash values are stored in `coach_invite_codes.code_hash`.
- Codes are consumed once after successful first-time workspace provisioning.

### Create Invite
```sql
INSERT INTO coach_invite_codes (id, code_hash, status, issued_to_email, created_at, expires_at)
VALUES (
  lower(hex(randomblob(16))),
  '<precomputed_sha256_hex_of_normalized_code>',
  'active',
  'coach@example.com',
  datetime('now'),
  datetime('now', '+14 days')
);
```

### Revoke Invite
```sql
UPDATE coach_invite_codes
SET status = 'revoked'
WHERE id = '<invite-id>';
```

### List Invite Status
```sql
SELECT id, status, issued_to_email, created_at, expires_at, used_at, used_by_email, consumed_workspace_id
FROM coach_invite_codes
ORDER BY created_at DESC;
```

## Coach Purge / Test Reset
Use this when you need to fully remove a coach so the same Google account can register again during testing.

### Command
```bash
npm run remove:coach -- --email coach@example.com --dry-run
npm run remove:coach -- --email coach@example.com --yes
```

### What it removes
- Resolves the target by normalized `coach_tenants.owner_email`.
- Soft-deletes the workspace immediately, then hard-deletes it at the end.
- Deletes tenant-scoped rows from `coach_templates`, `coach_class_locations`, `coach_social_links` when present, `analytics_events`, and `analytics_rollup_daily`.
- Deletes invite-code rows tied to the email or consumed workspace.
- Deletes `content_jobs` rows whose stored blob path or URL points at `tenants/<workspaceId>/`.
- Deletes every Vercel Blob object under `tenants/<workspaceId>/`, including branding images and QR code blobs.

### Preflight
1. Run the dry run first and confirm the resolved workspace id/slug is the one you expect.
2. If more than one `coach_tenants` row matches the email, stop and resolve the ambiguity manually.
3. Make sure `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `BLOB_READ_WRITE_TOKEN` point at the correct environment.

### Postflight
1. Confirm the email no longer resolves to a `coach_tenants` row.
2. Confirm `vercel blob list --prefix tenants/<workspaceId>/` returns no blobs.
3. Re-register the coach with the same Google account.

## Cron
- Schedule a daily request to `GET or POST /api/portal/analytics-rollup`
- Header: `Authorization: Bearer <CRON_SECRET>`
- Keep `CRON_SECRET` consistent between Preview and Production in this model.

## Smoke Checks
1. Sign in with environment-appropriate Google client and load `/` dashboard.
2. Save and publish branding.
3. Upload a branding asset and verify URL prefix includes workspace tenant id.
4. Create/edit/publish/archive a template.
5. Ingest a test analytics event and run rollup.
6. Confirm dashboard metrics update for the selected date range.

