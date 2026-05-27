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

