# Portal API Contract (Phase 2)

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
  - Updates branding using optimistic concurrency (`expectedUpdatedAt`).
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

## Tenant Safety
- No endpoint accepts a client-provided tenant/workspace identifier for authorization.
- All record reads/writes are bound to session-resolved `workspaceId` in SQL `WHERE` clauses.