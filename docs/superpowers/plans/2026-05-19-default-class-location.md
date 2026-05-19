# Default Class Location — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a coach to designate one class location as the default; auto-assign the default when only one location exists.

**Architecture:** Add an `is_default` boolean column to `coach_class_locations`. The single-default invariant is enforced in the API handler: POST sets it on the first location, PATCH clears-then-sets, DELETE auto-promotes the sole remaining location. A new PATCH route is added to the existing serverless function (no new Vercel function created).

**Tech Stack:** TypeScript, Vitest, React, libsql/Turso, Vercel Serverless Functions

---

## Files

| File | Change |
|------|--------|
| `api/_db.ts` | Add `addColumnIfMissing` call for `is_default` |
| `api/portal/class-locations.ts` | Update `mapClassLocation`; add PATCH handler; update POST and DELETE |
| `api/portal/class-locations.test.ts` | Update `makeRow`; fix unsupported-method test; add new tests |
| `src/types/portal.ts` | Add `isDefault: boolean` to `ClassLocation` |
| `src/services/portalApi.ts` | Add `setDefaultClassLocation` method |
| `src/pages/ClassLocationsPage.tsx` | Add Default column with badge/button |
| `src/pages/ClassLocationEditorPage.tsx` | Add `isDefault` to form state; show badge or Set-as-Default button |

---

## Task 1: Schema migration and test file preparation

**Files:**
- Modify: `api/_db.ts`
- Modify: `src/types/portal.ts`
- Modify: `api/portal/class-locations.test.ts`

- [ ] **Step 1: Add column migration in `api/_db.ts`**

Add this line at the end of the `addColumnIfMissing` block inside `createCoachTenantTablesIfNeeded`, after the existing `coach_templates` migrations (around line 148):

```typescript
  await addColumnIfMissing('coach_class_locations', 'is_default INTEGER NOT NULL DEFAULT 0', 'is_default');
```

- [ ] **Step 2: Add `isDefault` to `ClassLocation` type in `src/types/portal.ts`**

Change the `ClassLocation` type:

```typescript
export type ClassLocation = {
  id: string;
  tenantId: string;
  businessName: string;
  locationName: string;
  logoUrl: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 3: Update `makeRow` in `api/portal/class-locations.test.ts`**

Add `is_default: 0` to the default row shape so tests reflect the new column:

```typescript
const makeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'loc1',
  tenant_id: 'w1',
  business_name: 'Infinity Fitness',
  location_name: 'Mission, BC',
  logo_url: '',
  is_default: 0,
  sort_order: 0,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  updated_by_google_sub: null,
  updated_by_email: null,
  ...overrides,
});
```

- [ ] **Step 4: Change unsupported-method test from PATCH to OPTIONS**

PATCH will become a valid method in Task 2. Update the existing test (currently at the bottom of the describe block) to use `OPTIONS` instead:

```typescript
  it('returns 405 for unsupported method', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn() } as never);

    const res = makeRes();
    await handler({ method: 'OPTIONS', query: { id: 'loc1' } }, res as never);

    expect(res.payload.code).toBe(405);
  });
```

- [ ] **Step 5: Run tests to confirm existing suite still passes**

```
npm test
```

Expected: all existing tests pass (the `makeRow` change is backward-compatible; OPTIONS still hits the 405 fallback).

- [ ] **Step 6: Commit**

```bash
git add api/_db.ts src/types/portal.ts api/portal/class-locations.test.ts
git commit -m "feat: add is_default column to class locations schema and update types"
```

---

## Task 2: `mapClassLocation` update + PATCH set-default endpoint + API service method

**Files:**
- Modify: `api/portal/class-locations.ts`
- Modify: `api/portal/class-locations.test.ts`
- Modify: `src/services/portalApi.ts`

- [ ] **Step 1: Write failing tests for PATCH**

Add these two tests inside the `describe` block in `api/portal/class-locations.test.ts`:

```typescript
  it('PATCH sets a location as default and returns 200', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    const row = makeRow({ is_default: 1 });
    const mockExecute = vi.fn().mockResolvedValue({ rows: [row] });
    const mockBatch = vi.fn().mockResolvedValue([]);
    vi.mocked(getDb).mockReturnValue({ execute: mockExecute, batch: mockBatch } as never);

    const res = makeRes();
    await handler({ method: 'PATCH', query: { id: 'loc1' } }, res as never);

    expect(res.payload.code).toBe(200);
    expect((res.payload.body as { data: { isDefault: boolean } }).data.isDefault).toBe(true);
    expect(mockBatch).toHaveBeenCalledOnce();
  });

  it('PATCH returns 404 for unknown location', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn().mockResolvedValue({ rows: [] }) } as never);

    const res = makeRes();
    await handler({ method: 'PATCH', query: { id: 'nonexistent' } }, res as never);

    expect(res.payload.code).toBe(404);
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --reporter=verbose api/portal/class-locations.test.ts
```

Expected: the two new PATCH tests fail ("expected 405, got 405" for the first — because PATCH hits the method-not-allowed fallback).

- [ ] **Step 3: Update `mapClassLocation` and add PATCH handler in `api/portal/class-locations.ts`**

Update `mapClassLocation` to include `isDefault`:

```typescript
function mapClassLocation(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    businessName: String(row.business_name),
    locationName: String(row.location_name),
    logoUrl: String(row.logo_url ?? ''),
    isDefault: Boolean(row.is_default),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    updatedByGoogleSub: row.updated_by_google_sub ? String(row.updated_by_google_sub) : null,
    updatedByEmail: row.updated_by_email ? String(row.updated_by_email) : null,
  };
}
```

Then add the PATCH handler inside `handler`, before the final `405` line (i.e., before `res.status(405).json(...)`):

```typescript
  if (req.method === 'PATCH') {
    const current = await loadLocation(db, id, auth.session.workspaceId);
    if (!current) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Location not found.'));
      return;
    }
    await db.batch([
      { sql: `UPDATE coach_class_locations SET is_default=0 WHERE tenant_id=?`, args: [auth.session.workspaceId] },
      { sql: `UPDATE coach_class_locations SET is_default=1 WHERE id=? AND tenant_id=?`, args: [id, auth.session.workspaceId] },
    ], 'write');
    const next = await loadLocation(db, id, auth.session.workspaceId);
    res.status(200).json({ data: mapClassLocation(next as Record<string, unknown>) });
    return;
  }
```

- [ ] **Step 4: Run tests to confirm PATCH tests pass**

```
npm test -- --reporter=verbose api/portal/class-locations.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Add `setDefaultClassLocation` to `src/services/portalApi.ts`**

Add after `deleteClassLocation`:

```typescript
  setDefaultClassLocation: (id: string) => api<ClassLocation>(`/api/portal/class-locations?id=${encodeURIComponent(id)}`, { method: 'PATCH' }),
```

- [ ] **Step 6: Run full test suite**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add api/portal/class-locations.ts api/portal/class-locations.test.ts src/services/portalApi.ts
git commit -m "feat: add PATCH set-default endpoint for class locations"
```

---

## Task 3: POST auto-default (first location gets is_default=1)

**Files:**
- Modify: `api/portal/class-locations.ts`
- Modify: `api/portal/class-locations.test.ts`

- [ ] **Step 1: Update existing create test to account for the new count query**

The POST handler will now issue a COUNT query before the INSERT. Update the existing `accepts empty logoUrl on create` test so its mock handles 3 sequential calls:

```typescript
  it('accepts empty logoUrl on create', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    const row = makeRow();
    const mockExecute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ cnt: 1 }] })  // COUNT existing
      .mockResolvedValueOnce({ rows: [] })              // INSERT
      .mockResolvedValueOnce({ rows: [row] });          // SELECT after insert
    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { businessName: 'Infinity Fitness', locationName: 'Mission, BC', logoUrl: '' } }, res as never);

    expect(res.payload.code).toBe(201);
  });
```

Also update the `returns 409 on duplicate location` test — the COUNT must succeed before the INSERT throws:

```typescript
  it('returns 409 on duplicate location', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    const mockExecute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ cnt: 1 }] })  // COUNT succeeds
      .mockRejectedValueOnce(new Error('UNIQUE constraint failed: coach_class_locations'));
    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { businessName: 'Infinity Fitness', locationName: 'Mission, BC' } }, res as never);

    expect(res.payload.code).toBe(409);
    expect((res.payload.body as { error: { code: string } }).error.code).toBe('DUPLICATE_LOCATION');
  });
```

- [ ] **Step 2: Write failing test for auto-default on first location**

Add this test to `api/portal/class-locations.test.ts`:

```typescript
  it('POST sets isDefault=true when creating the first location', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    const row = makeRow({ is_default: 1 });
    const mockExecute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ cnt: 0 }] })  // COUNT = 0 (first location)
      .mockResolvedValueOnce({ rows: [] })              // INSERT
      .mockResolvedValueOnce({ rows: [row] });          // SELECT after insert
    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { businessName: 'Infinity Fitness', locationName: 'Mission, BC' } }, res as never);

    expect(res.payload.code).toBe(201);
    expect((res.payload.body as { data: { isDefault: boolean } }).data.isDefault).toBe(true);
  });
```

- [ ] **Step 3: Run tests to confirm new test fails**

```
npm test -- --reporter=verbose api/portal/class-locations.test.ts
```

Expected: new `POST sets isDefault=true` test fails (handler doesn't count yet).

- [ ] **Step 4: Update POST handler in `api/portal/class-locations.ts` to count first**

Replace the POST handler block (starting at `if (req.method === 'POST' && !id)`) with:

```typescript
  if (req.method === 'POST' && !id) {
    const payload = parsePayload(req.body);
    if (!payload.businessName) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'businessName is required.'));
      return;
    }
    if (!payload.locationName) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'locationName is required.'));
      return;
    }
    if (payload.logoUrl && !validateTenantAssetRefs([payload.logoUrl], auth.session.workspaceId)) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'logoUrl does not belong to this workspace.'));
      return;
    }

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as cnt FROM coach_class_locations WHERE tenant_id = ?`,
      args: [auth.session.workspaceId],
    });
    const existingCount = Number((countResult.rows[0] as Record<string, unknown>)?.cnt ?? 0);
    const isDefault = existingCount === 0 ? 1 : 0;

    const newId = randomUUID();
    const now = nowIso();
    try {
      await db.execute({
        sql: `
          INSERT INTO coach_class_locations (
            id, tenant_id, business_name, location_name, logo_url, is_default, sort_order,
            created_at, updated_at, updated_by_google_sub, updated_by_email
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        `,
        args: [newId, auth.session.workspaceId, payload.businessName, payload.locationName, payload.logoUrl, isDefault, now, now, auth.session.sub, auth.session.email],
      });
    } catch (err) {
      if (isDuplicateError(err)) {
        res.status(409).json(errorResponse('DUPLICATE_LOCATION', 'A location with this business and location name already exists.'));
        return;
      }
      throw err;
    }

    const inserted = await db.execute({ sql: `SELECT * FROM coach_class_locations WHERE id = ? LIMIT 1`, args: [newId] });
    res.status(201).json({ data: mapClassLocation(inserted.rows[0] as Record<string, unknown>) });
    return;
  }
```

- [ ] **Step 5: Run tests to confirm all pass**

```
npm test -- --reporter=verbose api/portal/class-locations.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add api/portal/class-locations.ts api/portal/class-locations.test.ts
git commit -m "feat: auto-set is_default on first class location creation"
```

---

## Task 4: DELETE auto-promote (sole remaining location becomes default)

**Files:**
- Modify: `api/portal/class-locations.ts`
- Modify: `api/portal/class-locations.test.ts`

- [ ] **Step 1: Write failing test for auto-promote**

Add this test to `api/portal/class-locations.test.ts`:

```typescript
  it('DELETE promotes sole remaining location to default when deleting the default', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    const deletedRow = makeRow({ id: 'loc1', is_default: 1 });
    const remainingRow = makeRow({ id: 'loc2', is_default: 0, location_name: 'Downtown' });
    const mockExecute = vi.fn()
      .mockResolvedValueOnce({ rows: [deletedRow] })     // loadLocation (guard)
      .mockResolvedValueOnce({ rows: [] })                // DELETE
      .mockResolvedValueOnce({ rows: [remainingRow] })   // SELECT remaining
      .mockResolvedValueOnce({ rows: [] });               // UPDATE remaining to is_default=1
    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as never);

    const res = makeRes();
    await handler({ method: 'DELETE', query: { id: 'loc1' } }, res as never);

    expect(res.payload.code).toBe(200);
    // The 4th execute call should be the auto-promote UPDATE
    expect(mockExecute).toHaveBeenCalledTimes(4);
  });
```

Also update the existing `deletes existing location` test — `makeRow()` now has `is_default: 0` by default (already done in Task 1), but the mock needs to handle only the non-default case (2 calls: loadLocation + DELETE, no remaining query):

```typescript
  it('deletes existing location', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    const row = makeRow({ is_default: 0 });
    const mockExecute = vi.fn()
      .mockResolvedValueOnce({ rows: [row] })  // loadLocation
      .mockResolvedValueOnce({ rows: [] });    // DELETE
    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as never);

    const res = makeRes();
    await handler({ method: 'DELETE', query: { id: 'loc1' } }, res as never);

    expect(res.payload.code).toBe(200);
  });
```

- [ ] **Step 2: Run tests to confirm new test fails**

```
npm test -- --reporter=verbose api/portal/class-locations.test.ts
```

Expected: `DELETE promotes sole remaining location` fails.

- [ ] **Step 3: Update DELETE handler in `api/portal/class-locations.ts`**

Replace the DELETE handler block with:

```typescript
  if (req.method === 'DELETE') {
    const current = await loadLocation(db, id, auth.session.workspaceId);
    if (!current) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Location not found.'));
      return;
    }
    const wasDefault = Boolean(current.is_default);
    await db.execute({
      sql: `DELETE FROM coach_class_locations WHERE id = ? AND tenant_id = ?`,
      args: [id, auth.session.workspaceId],
    });
    if (wasDefault) {
      const remaining = await db.execute({
        sql: `SELECT * FROM coach_class_locations WHERE tenant_id = ? ORDER BY sort_order ASC, updated_at DESC`,
        args: [auth.session.workspaceId],
      });
      if (remaining.rows.length === 1) {
        await db.execute({
          sql: `UPDATE coach_class_locations SET is_default=1 WHERE id=? AND tenant_id=?`,
          args: [String((remaining.rows[0] as Record<string, unknown>).id), auth.session.workspaceId],
        });
      }
    }
    res.status(200).json({ data: { id } });
    return;
  }
```

- [ ] **Step 4: Run full test suite**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/portal/class-locations.ts api/portal/class-locations.test.ts
git commit -m "feat: auto-promote sole remaining location to default on delete"
```

---

## Task 5: ClassLocationsPage — Default column

**Files:**
- Modify: `src/pages/ClassLocationsPage.tsx`

- [ ] **Step 1: Update `ClassLocationsPage`**

Replace the full file content with:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { portalApi } from '../services/portalApi';
import type { ClassLocation } from '../types/portal';

export function ClassLocationsPage() {
  const [locations, setLocations] = useState<ClassLocation[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      setLocations(await portalApi.listClassLocations());
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    let active = true;
    portalApi.listClassLocations()
      .then((items) => {
        if (!active) return;
        setError('');
        setLocations(items);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Delete "${label}"?`)) return;
    try {
      await portalApi.deleteClassLocation(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const setDefault = async (id: string) => {
    try {
      await portalApi.setDefaultClassLocation(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="panel page-section">
      <div className="row spread">
        <h2>Class Locations</h2>
        <Link className="button" to="/class-locations/new">Add Location</Link>
      </div>
      {error && <p className="error">{error}</p>}
      {locations.length === 0
        ? <p className="muted">No locations yet. Add your first class location.</p>
        : (
          <table className="table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Location</th>
                <th>Logo</th>
                <th>Default</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id}>
                  <td><Link to={`/class-locations/${loc.id}`}>{loc.businessName}</Link></td>
                  <td>{loc.locationName}</td>
                  <td>
                    {loc.logoUrl
                      ? <img src={`/api/portal/branding?action=asset-image&url=${encodeURIComponent(loc.logoUrl)}`} alt={`${loc.businessName} logo`} style={{ height: '32px', width: 'auto', verticalAlign: 'middle' }} />
                      : <span className="muted">&mdash;</span>}
                  </td>
                  <td>
                    {loc.isDefault
                      ? <span className="badge">Default</span>
                      : locations.length > 1 && (
                        <button className="button-small" onClick={() => void setDefault(loc.id)}>Set as Default</button>
                      )}
                  </td>
                  <td>{loc.updatedAt}</td>
                  <td className="actions">
                    <button onClick={() => void remove(loc.id, `${loc.businessName} – ${loc.locationName}`)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </section>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ClassLocationsPage.tsx
git commit -m "feat: show default badge and set-default button in class locations list"
```

---

## Task 6: ClassLocationEditorPage — Default badge/button

**Files:**
- Modify: `src/pages/ClassLocationEditorPage.tsx`

- [ ] **Step 1: Update `ClassLocationEditorPage`**

Replace the full file content with:

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { portalApi } from '../services/portalApi';

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

type FormState = {
  businessName: string;
  locationName: string;
  logoUrl: string;
  isDefault: boolean;
};

const emptyForm = (): FormState => ({ businessName: '', locationName: '', logoUrl: '', isDefault: false });

export function ClassLocationEditorPage() {
  const { id = 'new' } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState('');
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    if (id === 'new') return;
    void (async () => {
      try {
        const data = await portalApi.getClassLocation(id);
        setForm({ businessName: data.businessName, locationName: data.locationName, logoUrl: data.logoUrl, isDefault: data.isDefault });
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [id]);

  const save = async () => {
    try {
      setIsMutating(true);
      setError('');
      if (id === 'new') {
        const created = await portalApi.createClassLocation({ businessName: form.businessName, locationName: form.locationName, logoUrl: '' });
        navigate(`/class-locations/${created.id}`, { replace: true });
      } else {
        await portalApi.updateClassLocation(id, { businessName: form.businessName, locationName: form.locationName, logoUrl: form.logoUrl });
        setError('');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMutating(false);
    }
  };

  const uploadLogo = async (file: File) => {
    if (id === 'new') return;
    try {
      setIsMutating(true);
      setError('');
      const dataBase64 = await toBase64(file);
      const uploaded = await portalApi.uploadAsset({ assetType: `class-location-${id}`, filename: file.name, contentType: file.type, dataBase64 });
      const next = { ...form, logoUrl: uploaded.url };
      await portalApi.updateClassLocation(id, { businessName: next.businessName, locationName: next.locationName, logoUrl: next.logoUrl });
      setForm(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMutating(false);
    }
  };

  const setDefault = async () => {
    try {
      setIsMutating(true);
      setError('');
      await portalApi.setDefaultClassLocation(id);
      setForm((f) => ({ ...f, isDefault: true }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMutating(false);
    }
  };

  const isNew = id === 'new';

  return (
    <section className="panel page-section">
      <div className="row spread">
        <h2>{isNew ? 'Add Location' : 'Edit Location'}</h2>
        <Link to="/class-locations">Back</Link>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="grid2">
        <label>
          Business Name
          <input
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            placeholder="e.g. Infinity Fitness"
          />
        </label>
        <label>
          Location
          <input
            value={form.locationName}
            onChange={(e) => setForm({ ...form, locationName: e.target.value })}
            placeholder="e.g. Mission, BC"
          />
        </label>
      </div>
      {!isNew && (
        <>
          <div>
            <p>Business Logo <span className="muted">(optional)</span></p>
            <div className="asset-preview-grid">
              <div className="asset-preview-card">
                {form.logoUrl
                  ? <img src={`/api/portal/branding?action=asset-image&url=${encodeURIComponent(form.logoUrl)}`} alt="Business logo preview" className="asset-preview-image" />
                  : <div className="asset-preview-placeholder">No logo</div>}
              </div>
            </div>
            <label>
              Upload Logo
              <input
                type="file"
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                disabled={isMutating}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); }}
              />
            </label>
          </div>
          <div className="row">
            {form.isDefault
              ? <span className="badge">Default location</span>
              : (
                <button className="button-secondary" disabled={isMutating} onClick={() => void setDefault()}>
                  Set as Default
                </button>
              )}
          </div>
        </>
      )}
      {isNew && <p className="muted">Save the location first, then you can upload a logo.</p>}
      <div className="row">
        <button className="button" disabled={isMutating} onClick={() => void save()}>
          {isNew ? 'Save Location' : 'Save Changes'}
        </button>
        <Link to="/class-locations">Cancel</Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ClassLocationEditorPage.tsx
git commit -m "feat: show default badge and set-default button in location editor"
```
