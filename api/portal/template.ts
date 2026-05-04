import { randomUUID } from 'node:crypto';
import { getDb } from '../_db.js';
import { requirePortalSession } from '../_portalAuth.js';
import { errorResponse, nowIso, type NodeReq, type NodeRes } from '../_http.js';

const asObject = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});
const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const asNumber = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};
const asBoolean = (value: unknown) => value === true;

const parseWorkoutTypes = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, 24).map((entry) => String(entry).trim());
};

function mapTemplate(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    stationCount: Number(row.station_count ?? 1),
    stationWorkoutTypes: (() => {
      try {
        return JSON.parse(String(row.station_workout_types_json ?? '[]')) as string[];
      } catch {
        return [];
      }
    })(),
    roundsPerStation: Number(row.rounds_per_station ?? 1),
    workMinutes: Number(row.work_minutes ?? 0),
    workSeconds: Number(row.work_seconds ?? 30),
    restMinutes: Number(row.rest_minutes ?? 0),
    restSeconds: Number(row.rest_seconds ?? 30),
    stationTransitionMinutes: Number(row.station_transition_minutes ?? 0),
    stationTransitionSeconds: Number(row.station_transition_seconds ?? 15),
    startStationWorkManually: Number(row.start_station_work_manually ?? 0) === 1,
    warmupEnabled: Number(row.warmup_enabled ?? 0) === 1,
    warmupMinutes: Number(row.warmup_minutes ?? 0),
    warmupSeconds: Number(row.warmup_seconds ?? 0),
    cooldownEnabled: Number(row.cooldown_enabled ?? 0) === 1,
    cooldownMinutes: Number(row.cooldown_minutes ?? 0),
    cooldownSeconds: Number(row.cooldown_seconds ?? 0),
    status: String(row.status ?? 'draft'),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    publishedAt: row.published_at ? String(row.published_at) : null,
    archivedAt: row.archived_at ? String(row.archived_at) : null,
    updatedByGoogleSub: row.updated_by_google_sub ? String(row.updated_by_google_sub) : null,
    updatedByEmail: row.updated_by_email ? String(row.updated_by_email) : null,
  };
}

function parseTemplatePayload(body: unknown) {
  const obj = asObject(body);
  return {
    name: asString(obj.name),
    stationCount: asNumber(obj.stationCount, 1),
    stationWorkoutTypes: parseWorkoutTypes(obj.stationWorkoutTypes),
    roundsPerStation: asNumber(obj.roundsPerStation, 1),
    workMinutes: asNumber(obj.workMinutes, 0),
    workSeconds: asNumber(obj.workSeconds, 30),
    restMinutes: asNumber(obj.restMinutes, 0),
    restSeconds: asNumber(obj.restSeconds, 30),
    stationTransitionMinutes: asNumber(obj.stationTransitionMinutes, 0),
    stationTransitionSeconds: asNumber(obj.stationTransitionSeconds, 15),
    startStationWorkManually: asBoolean(obj.startStationWorkManually),
    warmupEnabled: asBoolean(obj.warmupEnabled),
    warmupMinutes: asNumber(obj.warmupMinutes, 0),
    warmupSeconds: asNumber(obj.warmupSeconds, 0),
    cooldownEnabled: asBoolean(obj.cooldownEnabled),
    cooldownMinutes: asNumber(obj.cooldownMinutes, 0),
    cooldownSeconds: asNumber(obj.cooldownSeconds, 0),
    expectedUpdatedAt: asString(obj.expectedUpdatedAt),
  };
}

async function loadTemplate(db: ReturnType<typeof getDb>, templateId: string, tenantId: string) {
  const result = await db.execute({
    sql: `SELECT * FROM coach_templates WHERE id = ? AND tenant_id = ? LIMIT 1`,
    args: [templateId, tenantId],
  });
  return result.rows[0] as Record<string, unknown> | undefined;
}

export default async function handler(req: NodeReq, res: NodeRes) {
  const auth = await requirePortalSession(req);
  if (!auth.ok) {
    res.status(auth.status).json(errorResponse('AUTH_REQUIRED', 'Authentication required.'));
    return;
  }

  const id = typeof req.query?.id === 'string' ? req.query.id : '';
  if (!id) {
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'Missing template id.'));
    return;
  }

  const db = getDb();
  const current = await loadTemplate(db, id, auth.session.workspaceId);
  if (!current) {
    res.status(404).json(errorResponse('NOT_FOUND', 'Template not found.'));
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({ data: mapTemplate(current) });
    return;
  }

  if (req.method === 'PUT') {
    const payload = parseTemplatePayload(req.body);
    if (!payload.name) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'name is required'));
      return;
    }
    if (payload.expectedUpdatedAt !== String(current.updated_at ?? '')) {
      res.status(409).json(errorResponse('CONFLICT', 'Template was updated by another session.'));
      return;
    }

    const now = nowIso();
    await db.execute({
      sql: `
        UPDATE coach_templates
        SET name = ?, station_count = ?, station_workout_types_json = ?, rounds_per_station = ?,
            work_minutes = ?, work_seconds = ?, rest_minutes = ?, rest_seconds = ?,
            station_transition_minutes = ?, station_transition_seconds = ?, start_station_work_manually = ?,
            warmup_enabled = ?, warmup_minutes = ?, warmup_seconds = ?, cooldown_enabled = ?,
            cooldown_minutes = ?, cooldown_seconds = ?, updated_at = ?, updated_by_google_sub = ?, updated_by_email = ?
        WHERE id = ? AND tenant_id = ?
      `,
      args: [
        payload.name,
        payload.stationCount,
        JSON.stringify(payload.stationWorkoutTypes),
        payload.roundsPerStation,
        payload.workMinutes,
        payload.workSeconds,
        payload.restMinutes,
        payload.restSeconds,
        payload.stationTransitionMinutes,
        payload.stationTransitionSeconds,
        payload.startStationWorkManually ? 1 : 0,
        payload.warmupEnabled ? 1 : 0,
        payload.warmupMinutes,
        payload.warmupSeconds,
        payload.cooldownEnabled ? 1 : 0,
        payload.cooldownMinutes,
        payload.cooldownSeconds,
        now,
        auth.session.sub,
        auth.session.email,
        id,
        auth.session.workspaceId,
      ],
    });

    const next = await loadTemplate(db, id, auth.session.workspaceId);
    res.status(200).json({ data: mapTemplate(next as Record<string, unknown>) });
    return;
  }

  if (req.method === 'POST') {
    const action = typeof req.query?.action === 'string' ? req.query.action : '';
    const now = nowIso();

    if (action === 'publish') {
      await db.execute({
        sql: `
          UPDATE coach_templates
          SET status = 'published', published_at = ?, archived_at = NULL, updated_at = ?,
              updated_by_google_sub = ?, updated_by_email = ?
          WHERE id = ? AND tenant_id = ?
        `,
        args: [now, now, auth.session.sub, auth.session.email, id, auth.session.workspaceId],
      });
    } else if (action === 'archive') {
      await db.execute({
        sql: `
          UPDATE coach_templates
          SET status = 'archived', archived_at = ?, updated_at = ?, updated_by_google_sub = ?, updated_by_email = ?
          WHERE id = ? AND tenant_id = ?
        `,
        args: [now, now, auth.session.sub, auth.session.email, id, auth.session.workspaceId],
      });
    } else if (action === 'unarchive') {
      await db.execute({
        sql: `
          UPDATE coach_templates
          SET status = 'draft', archived_at = NULL, updated_at = ?, updated_by_google_sub = ?, updated_by_email = ?
          WHERE id = ? AND tenant_id = ?
        `,
        args: [now, auth.session.sub, auth.session.email, id, auth.session.workspaceId],
      });
    } else if (action === 'duplicate') {
      const copyId = randomUUID();
      await db.execute({
        sql: `
          INSERT INTO coach_templates (
            id, tenant_id, name, station_count, station_workout_types_json, rounds_per_station,
            work_minutes, work_seconds, rest_minutes, rest_seconds, station_transition_minutes,
            station_transition_seconds, start_station_work_manually, warmup_enabled, warmup_minutes,
            warmup_seconds, cooldown_enabled, cooldown_minutes, cooldown_seconds, status, sort_order,
            created_at, updated_at, updated_by_google_sub, updated_by_email
          )
          SELECT ?, tenant_id, name || ' (Copy)', station_count, station_workout_types_json, rounds_per_station,
                 work_minutes, work_seconds, rest_minutes, rest_seconds, station_transition_minutes,
                 station_transition_seconds, start_station_work_manually, warmup_enabled, warmup_minutes,
                 warmup_seconds, cooldown_enabled, cooldown_minutes, cooldown_seconds, 'draft', sort_order,
                 ?, ?, ?, ?
          FROM coach_templates
          WHERE id = ? AND tenant_id = ?
        `,
        args: [copyId, now, now, auth.session.sub, auth.session.email, id, auth.session.workspaceId],
      });
      const created = await loadTemplate(db, copyId, auth.session.workspaceId);
      res.status(201).json({ data: mapTemplate(created as Record<string, unknown>) });
      return;
    } else {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Unsupported action.'));
      return;
    }

    const next = await loadTemplate(db, id, auth.session.workspaceId);
    res.status(200).json({ data: mapTemplate(next as Record<string, unknown>) });
    return;
  }

  res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed.'));
}