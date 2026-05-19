import { randomUUID } from 'node:crypto';
import { getDb } from '../_db.js';
import { requirePortalSession } from '../_portalAuth.js';
import { errorResponse, nowIso, type NodeReq, type NodeRes } from '../_http.js';
import { validateTenantAssetRefs } from '../_assets.js';

const asObject = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});
const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

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

function parsePayload(body: unknown) {
  const obj = asObject(body);
  return {
    businessName: asString(obj.businessName),
    locationName: asString(obj.locationName),
    logoUrl: asString(obj.logoUrl),
  };
}

function isDuplicateError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('UNIQUE constraint failed') && msg.includes('coach_class_locations');
}

async function loadLocation(db: ReturnType<typeof getDb>, locationId: string, tenantId: string) {
  const result = await db.execute({
    sql: `SELECT * FROM coach_class_locations WHERE id = ? AND tenant_id = ? LIMIT 1`,
    args: [locationId, tenantId],
  });
  return result.rows[0] as Record<string, unknown> | undefined;
}

export default async function handler(req: NodeReq, res: NodeRes) {
  const auth = await requirePortalSession(req);
  if (!auth.ok) {
    res.status(auth.status).json(errorResponse('AUTH_REQUIRED', 'Authentication required.'));
    return;
  }

  const db = getDb();
  const id = typeof req.query?.id === 'string' ? req.query.id : '';

  // --- Collection operations ---

  if (req.method === 'GET' && !id) {
    const result = await db.execute({
      sql: `SELECT * FROM coach_class_locations WHERE tenant_id = ? ORDER BY sort_order ASC, updated_at DESC`,
      args: [auth.session.workspaceId],
    });
    res.status(200).json({ data: result.rows.map((row) => mapClassLocation(row as Record<string, unknown>)) });
    return;
  }

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

  // --- Item operations (require id) ---

  if (!id) {
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'Missing location id.'));
    return;
  }

  if (req.method === 'GET') {
    const current = await loadLocation(db, id, auth.session.workspaceId);
    if (!current) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Location not found.'));
      return;
    }
    res.status(200).json({ data: mapClassLocation(current) });
    return;
  }

  if (req.method === 'PUT') {
    const current = await loadLocation(db, id, auth.session.workspaceId);
    if (!current) {
      res.status(404).json(errorResponse('NOT_FOUND', 'Location not found.'));
      return;
    }

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

    const now = nowIso();
    try {
      await db.execute({
        sql: `
          UPDATE coach_class_locations
          SET business_name = ?, location_name = ?, logo_url = ?, updated_at = ?,
              updated_by_google_sub = ?, updated_by_email = ?
          WHERE id = ? AND tenant_id = ?
        `,
        args: [payload.businessName, payload.locationName, payload.logoUrl, now, auth.session.sub, auth.session.email, id, auth.session.workspaceId],
      });
    } catch (err) {
      if (isDuplicateError(err)) {
        res.status(409).json(errorResponse('DUPLICATE_LOCATION', 'A location with this business and location name already exists.'));
        return;
      }
      throw err;
    }

    const next = await loadLocation(db, id, auth.session.workspaceId);
    res.status(200).json({ data: mapClassLocation(next as Record<string, unknown>) });
    return;
  }

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

  res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed.'));
}
