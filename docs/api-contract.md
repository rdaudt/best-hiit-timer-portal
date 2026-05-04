# Portal API Contract (Phase 2-3)

## Authentication
All `/api/portal/*` endpoints require authenticated session cookie and workspace resolution by `owner_google_sub`.

## Error Envelope
```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": null
  }
}
```

## Endpoints
- `GET /api/portal/workspace`
  - Returns resolved actor and workspace identity.
- `GET /api/portal/branding`
  - Returns workspace branding/profile state.
- `PUT /api/portal/branding`
  - Updates branding using optimistic concurrency (`expectedUpdatedAt`) and enforces tenant-owned asset references.
- `POST /api/portal/branding?action=publish`
  - Publishes workspace branding (`status=published`).
- `GET /api/portal/templates?status=all|draft|published|archived`
  - Lists workspace templates filtered by status.
- `POST /api/portal/templates`
  - Creates a draft template.
- `GET /api/portal/template?id={templateId}`
  - Loads one template (workspace-scoped).
- `PUT /api/portal/template?id={templateId}`
  - Updates one template with optimistic concurrency (`expectedUpdatedAt`).
- `POST /api/portal/template?id={templateId}&action=publish|archive|unarchive|duplicate`
  - Executes template lifecycle action.
- `POST /api/portal/assets-upload`
  - Uploads binary data to Vercel Blob into a tenant-prefixed path: `tenants/{workspaceId}/...`.

## Tenant Safety
- No endpoint accepts a client-provided tenant/workspace identifier for authorization.
- All record reads/writes are bound to session-resolved `workspaceId` in SQL `WHERE` clauses.
- Blob uploads are forced to tenant-prefixed paths.
- Branding asset URLs are rejected if they do not map to the authenticated workspace blob prefix.