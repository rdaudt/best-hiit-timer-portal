# Portal API Contract (Phase 2-6)

## Authentication
All `/api/portal/*` endpoints require authenticated session cookie unless explicitly noted as ingest/cron integration endpoint.

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
- `GET /api/portal/branding`
- `PUT /api/portal/branding`
- `POST /api/portal/branding?action=publish`
- `GET /api/portal/templates?status=all|draft|published|archived`
- `POST /api/portal/templates`
- `GET /api/portal/template?id={templateId}`
- `PUT /api/portal/template?id={templateId}`
- `POST /api/portal/template?id={templateId}&action=publish|archive|unarchive|duplicate`
- `POST /api/portal/assets-upload`
- `GET /api/portal/analytics-summary?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`

Integration endpoints:
- `POST /api/portal/analytics-ingest`
  - Requires `tenantSlug`, `eventName`; optionally secured by `Authorization: Bearer <ANALYTICS_INGEST_SECRET>`.
- `GET|POST /api/portal/analytics-rollup`
  - Requires `Authorization: Bearer <CRON_SECRET>`.

## Tenant Safety
- No protected endpoint accepts client-provided tenant ids for authorization.
- SQL reads/writes are bound to session-resolved workspace ids.
- Blob uploads use server-generated paths under `tenants/{workspaceId}/...`.
- Branding asset URLs must map to authenticated workspace prefix.
- Analytics summary reads only the authenticated workspace tenant_id.