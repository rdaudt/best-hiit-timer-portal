# Best HIIT Timer Portal

Coach-facing admin portal for branding, workout template management, and tenant-scoped analytics in the HIIT ecosystem.

This document is intentionally technical. It is written for engineers integrating the timer runtime with data authored in this portal.

## 1) System Role and Boundary

- `best-hiit-timer-portal` is the write surface for coach-managed content.
- The timer application is a separate runtime/consumer and should treat portal-authored data as upstream source of truth.
- Portal and timer deploy independently, but can share backend resources (Turso + Blob) by environment policy.

### Ownership model

- Portal owns mutation of:
  - tenant profile/branding (`coach_tenants`)
  - template catalog (`coach_templates`)
- Timer owns run-time execution and user session interactions.
- Analytics ingestion is timer-facing (timer emits events); analytics summary is portal-facing (coach dashboard reads aggregates).

## 2) Architecture Overview

### Frontend

- React + TypeScript + Vite SPA
- React Router for authenticated portal routes
- Optimistic concurrency on editable resources via `expectedUpdatedAt`

### Backend

- Vercel serverless functions under `api/*`
- Session-authenticated portal APIs under `api/portal/*`
- Integration APIs:
  - `POST /api/portal/analytics-ingest`
  - `GET|POST /api/portal/analytics-rollup`

### Data and storage

- Turso (LibSQL) for relational data
- Vercel Blob for uploaded branding assets
- OAuth identity: Google OIDC

## 3) Tenant and Identity Model

### Core mapping

- One Google subject (`sub`) maps to one workspace (`coach_tenants.owner_google_sub UNIQUE`).
- Workspace identity for portal APIs is always server-resolved from signed session cookie.
- Client payload tenant IDs are never trusted for authorization.

### Auto-provisioning on first sign-in

- Callback endpoint creates workspace if none exists.
- Slug generation derives from email local-part and enforces global uniqueness.
- Slug uniqueness checks include soft-deleted tenants to avoid collisions with `coach_tenants.slug UNIQUE`.

### Session behavior

- Session cookie stores actor identity + workspace slug context.
- Protected portal APIs require valid session and active (non-deleted) workspace.
- Deleted workspace access fails authorization (`403`).

## 4) Data Model and Lifecycle Semantics

Reference schema: [docs/turso-schema.sql](./docs/turso-schema.sql)

### `coach_tenants` (profile/branding)

Key fields:

- Identity: `id`, `slug`, `owner_google_sub`, `owner_email`
- Branding payload: `business_name`, `coach_name`, `bio`, `logo_url`, `coach_photo_url`, `coach_header_image_url`, `qr_code_url`, theme colors, headline
- Lifecycle: `status` (`draft|published`), `published_at`
- Soft delete: `deleted_at`, `deleted_by_google_sub`, `deleted_by_email`
- Audit: `updated_at`, `updated_by_google_sub`, `updated_by_email`

Lifecycle actions:

- `publish`: `status='published'`, sets `published_at`
- `unpublish`: `status='draft'`, clears `published_at`
- `delete` (soft): sets `deleted_at` (+ deleter audit fields)

Important: deletion is not represented with a third `status`; deletion is represented exclusively by `deleted_at`.

### `coach_templates` (workout templates)

Lifecycle states:

- `draft`
- `published`
- `archived`

Action semantics:

- `publish`: marks template published, sets `published_at`, clears `archived_at`
- `archive`: marks archived, sets `archived_at`
- `unarchive`: returns to `draft`, clears `archived_at`
- `duplicate`: creates new draft copy

### Analytics tables

- `analytics_events`: raw append-only event stream by `tenant_id`
- `analytics_rollup_daily`: daily aggregates keyed by `(tenant_id, day_utc)`

## 5) Timer Integration Contract

This is the critical contract for the timer app.

### Tenant activation rules

Treat a tenant as active only when:

- `coach_tenants.deleted_at IS NULL`

For “public/live” profile usage, also require:

- `coach_tenants.status = 'published'`

### Slug behavior

- Slug is globally unique, including soft-deleted tenants.
- A deleted tenant slug is intentionally not reusable by auto-provisioning.
- Integration lookup paths that resolve active tenant context by slug must exclude soft-deleted tenants.

### Template consumption rules

Timer should consume templates where:

- `tenant_id = active tenant id`
- `status = 'published'`

Draft/archived templates are portal authoring states and not runtime catalog.

### Branding asset safety

Portal validates uploaded branding URLs belong to workspace storage prefix.
Consumers can trust that persisted branding asset references are tenant-scoped URLs produced by portal upload flow.

### Analytics ingest

Timer emits one of:

- `app_opened`
- `timer_created`
- `timer_run_completed`
- `timer_run_incomplete`
- `timer_created_from_template`

Payload normalization includes numeric fields like duration/station/round/work/rest metrics.

## 6) API Surface (Portal + Integration)

Reference: [docs/api-contract.md](./docs/api-contract.md)

Portal (session required):

- `GET /api/portal/workspace`
- `GET /api/portal/branding`
- `PUT /api/portal/branding`
- `POST /api/portal/branding?action=publish|unpublish|delete`
- `GET /api/portal/templates?status=all|draft|published|archived`
- `POST /api/portal/templates`
- `GET /api/portal/template?id={templateId}`
- `PUT /api/portal/template?id={templateId}`
- `POST /api/portal/template?id={templateId}&action=publish|archive|unarchive|duplicate`
- `POST /api/portal/assets-upload`
- `GET /api/portal/analytics-summary?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`

Integration:

- `POST /api/portal/analytics-ingest`
  - Optional bearer gate via `ANALYTICS_INGEST_SECRET`
- `GET|POST /api/portal/analytics-rollup`
  - Bearer gate via `CRON_SECRET`

Error envelope:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": null
  }
}
```

## 7) Consistency, Concurrency, and Safety Patterns

### Optimistic concurrency

- Branding and template update APIs require `expectedUpdatedAt`.
- Mismatch returns `409 CONFLICT` to prevent blind overwrite.

### Tenant isolation

- Workspace resolved from session, not request body/query tenant identifiers.
- All SQL access to tenant resources is bound to resolved workspace/tenant id.
- Cross-tenant asset references are denied.

### Soft-delete enforcement

- Portal session guard denies deleted workspace access.
- Slug-based integration resolver excludes deleted workspaces.

## 8) Environment and Deployment Topology

- Development: isolated resources (DB/Blob/OAuth)
- Preview + Production: shared resources

See:

- [docs/environment-matrix.md](./docs/environment-matrix.md)
- [docs/backend-setup-guide.md](./docs/backend-setup-guide.md)

Required env vars:

- `APP_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SESSION_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BLOB_READ_WRITE_TOKEN`
- `ANALYTICS_INGEST_SECRET`
- `CRON_SECRET`

## 9) Local Development

```bash
npm install
npm run dev
npm run test
npm run build
```

Copy `.env.example` to `.env.local` and provide local values.

## 10) Design Guidance for Timer Implementers

- Treat portal as authoritative source for coach-published configuration.
- Gate runtime availability by `deleted_at IS NULL` and `status='published'` where applicable.
- Never assume slug reuse after delete.
- Consume only published templates for end users.
- Preserve idempotency on analytics ingestion and rollup scheduling in timer infrastructure.

## 11) Related Docs

- [docs/architecture.md](./docs/architecture.md)
- [docs/api-contract.md](./docs/api-contract.md)
- [docs/tenant-isolation-contract.md](./docs/tenant-isolation-contract.md)
- [docs/turso-schema.sql](./docs/turso-schema.sql)
- [docs/environment-matrix.md](./docs/environment-matrix.md)

