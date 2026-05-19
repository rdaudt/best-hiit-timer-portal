# Default Class Location

## Overview

Coaches can designate one of their class locations as the default. Only one location per coach (tenant) may be the default at a time. If only one location exists, it is automatically the default and cannot be un-set.

## Database

Add column to `coach_class_locations`:

```sql
is_default INTEGER NOT NULL DEFAULT 0
```

Added via `addColumnIfMissing` in `api/_db.ts` — no migration needed. No unique DB constraint; the single-default invariant is enforced in application code.

## Auto-Default Rules

These rules keep `is_default` consistent without requiring the UI to manage it explicitly:

- **Create:** Count existing locations for the tenant before inserting. If count is 0, insert with `is_default=1`; otherwise `is_default=0`.
- **Delete:** After deleting a row, if that row had `is_default=1`, query remaining rows for the tenant. If exactly one remains, set it to `is_default=1`.

## API (`api/portal/class-locations.ts`)

No new serverless function. The `PATCH` method is added to the existing dispatcher (respects Vercel Hobby 12-function limit).

### `PATCH /api/portal/class-locations?id=<id>`

Sets the specified location as the default for the authenticated tenant.

- Requires auth session (same as other methods).
- Validates `id` is present and the location belongs to the tenant.
- Executes two statements via `db.batch`:
  1. `UPDATE coach_class_locations SET is_default=0 WHERE tenant_id=?`
  2. `UPDATE coach_class_locations SET is_default=1 WHERE id=? AND tenant_id=?`
- Returns `200` with the updated location object, or `404` if not found.

### Updated `mapClassLocation`

Adds `isDefault: Boolean(row.is_default)` to the returned object.

### Existing POST and DELETE

- **POST:** Counts existing locations before insert; sets `is_default=1` if this is the first.
- **DELETE:** After delete, if the deleted row was the default, auto-promotes the sole remaining location (if any).

## TypeScript

**`src/types/portal.ts`:** Add `isDefault: boolean` to `ClassLocation`.

**`src/services/portalApi.ts`:** Add:

```typescript
setDefaultClassLocation: (id: string) =>
  api<ClassLocation>(`/api/portal/class-locations?id=${encodeURIComponent(id)}`, { method: 'PATCH' }),
```

## Frontend

### `ClassLocationsPage` (list view)

- Add a **Default** column to the table.
- Default row: shows a "Default" badge (non-interactive).
- Non-default rows: show a "Set as Default" button that calls `setDefaultClassLocation(id)` then reloads the list.
- If `locations.length === 1`, hide the button (the location is automatically the default).

### `ClassLocationEditorPage` (edit form)

- Load includes `isDefault` from the existing `getClassLocation` call.
- Below the form fields (edit mode only, not on new location):
  - If `isDefault`: show a "Default location" badge (read-only).
  - If not `isDefault`: show a "Set as Default" button.
- Button calls `setDefaultClassLocation(id)` then re-fetches the location to update the badge.
- If only one location exists the button is hidden — determined by a separate `listClassLocations` call on mount, or by a count returned from the API. Given the editor already doesn't know about other locations, the simplest approach: always show the button on non-default locations; the auto-default rule on the API side means this edge case is harmless (PATCH on the only location is a no-op in effect).

> **Simplification note:** The "hide button if only one location" rule in the editor is cosmetic. It is enforced correctly in the list view where all locations are visible. The editor can omit this check to avoid an extra API call.

## Error Handling

- `404` if the location doesn't exist or belongs to a different tenant.
- No special error for "already the default" — idempotent, returns `200`.
- Existing `AUTH_REQUIRED` guard applies to PATCH same as other methods.
