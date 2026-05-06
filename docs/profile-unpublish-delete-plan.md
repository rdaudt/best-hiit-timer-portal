# Add Coach Unpublish and Soft Delete for Profile

## Summary
Implement two new self-serve profile lifecycle actions in Profile & Branding:
- `Unpublish`: revert published profile to draft.
- `Delete Profile`: soft-delete the coach workspace while preserving templates/analytics for possible recovery.

Chosen behavior:
- Unpublish sets profile back to draft and clears publish timestamp.
- Delete is soft-delete (not hard delete).
- Linked data is retained but workspace is disabled for active portal/timer use.

## Key Changes
- Backend lifecycle actions (branding endpoint)
  - Extend branding action API to support:
    - `POST /api/portal/branding?action=unpublish`
    - `POST /api/portal/branding?action=delete`
  - `unpublish` update:
    - `status='draft'`
    - `published_at=NULL`
    - update audit fields (`updated_at`, actor fields).
  - `delete` update:
    - mark workspace inactive/deleted via soft-delete fields (recommended: add `deleted_at`, optional `deleted_by_google_sub`, `deleted_by_email`).
    - keep row and related data untouched.

- Workspace availability enforcement
  - Update session/workspace guard to reject deleted workspaces with safe denial response (prefer `403` with generic message).
  - Ensure deleted workspace cannot access protected portal APIs.
  - Keep authentication intact; authorization fails because workspace is disabled.

- Timer-facing behavior
  - Update tenant lookup used by integrations (notably slug-based analytics ingest) to ignore deleted workspaces.
  - Result: deleted profiles are not treated as active tenants by downstream flows.

- Frontend Profile & Branding UX
  - Add `Unpublish` button when status is published.
  - Add `Delete Profile` destructive action with typed confirmation dialog (e.g., require entering workspace slug).
  - After successful delete:
    - call logout endpoint
    - redirect to `/signin`
    - show clear message that profile is deleted/inactive.
  - Keep existing Save/Publish UX unchanged.

- Schema and contracts
  - Add soft-delete metadata columns on `coach_tenants` (migration via existing `addColumnIfMissing` pattern).
  - Extend branding response shape with `deletedAt` (nullable) so UI can react consistently.
  - Update API contract docs to include new branding actions and deleted-workspace behavior.

## Test Plan
- API tests
  - Branding action `unpublish` sets `status='draft'` and clears `published_at`.
  - Branding action `delete` sets `deleted_at` and audit fields.
  - Deleted workspace receives authorization denial on protected portal endpoints.
  - Slug/tenant resolver used by integrations does not return deleted workspaces.
  - Invalid/unsupported branding actions still return `405`.

- Frontend tests
  - Profile page shows `Unpublish` only for published state.
  - Delete confirmation flow requires explicit confirmation before API call.
  - Successful delete logs user out and routes to sign-in.
  - Error path surfaces server message and does not silently redirect.

- Regression checks
  - Save and Publish behavior remains unchanged.
  - Existing templates lifecycle tests remain green.
  - Auth routing still works for non-deleted workspaces.

## Assumptions and Defaults
- No self-serve restore flow is included in this change (admin/manual recovery only).
- Soft-deleted workspace data is retained indefinitely for now.
- Deletion only disables workspace access; it does not physically delete blobs/templates/analytics.
- `status` continues to use existing values (`draft|published`); deletion state is represented by `deleted_at` rather than introducing a new status enum.
