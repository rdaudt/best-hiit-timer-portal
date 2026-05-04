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
  };
}

function validateTemplateInput(template: ReturnType<typeof parseTemplatePayload>) {
  if (!template.name) {
    return 'name is required';
  }
  if (template.stationCount < 1 || template.stationCount > 99) {
    return 'stationCount must be between 1 and 99';
  }
  if (template.roundsPerStation < 1 || template.roundsPerStation > 99) {
    return 'roundsPerStation must be between 1 and 99';
  }
  return '';
}

export default async function handler(req: NodeReq, res: NodeRes) {
  const auth = await requirePortalSession(req);
  if (!auth.ok) {
    res.status(auth.status).json(errorResponse('AUTH_REQUIRED', 'Authentication required.'));
    return;
  }

  const db = getDb();

  if (req.method === 'GET') {
    const status = typeof req.query?.status === 'string' ? req.query.status : 'all';
    const sql = status === 'all'
      ? `SELECT * FROM coach_templates WHERE tenant_id = ? ORDER BY sort_order ASC, updated_at DESC`
      : `SELECT * FROM coach_templates WHERE tenant_id = ? AND status = ? ORDER BY sort_order ASC, updated_at DESC`;
    const args = status === 'all' ? [auth.session.workspaceId] : [auth.session.workspaceId, status];
    const result = await db.execute({ sql, args });
    res.status(200).json({ data: result.rows.map((row) => mapTemplate(row as Record<string, unknown>)) });
    return;
  }

  if (req.method === 'POST') {
    const payload = parseTemplatePayload(req.body);
    const validationError = validateTemplateInput(payload);
    if (validationError) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', validationError));
      return;
    }

    const id = randomUUID();
    const now = nowIso();
    await db.execute({
      sql: `
        INSERT INTO coach_templates (
          id, tenant_id, name, station_count, station_workout_types_json, rounds_per_station,
          work_minutes, work_seconds, rest_minutes, rest_seconds, station_transition_minutes,
          station_transition_seconds, start_station_work_manually, warmup_enabled, warmup_minutes,
          warmup_seconds, cooldown_enabled, cooldown_minutes, cooldown_seconds, status, sort_order,
          created_at, updated_at, updated_by_google_sub, updated_by_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?, ?, ?)
      `,
      args: [
        id,
        auth.session.workspaceId,
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
        now,
        auth.session.sub,
        auth.session.email,
      ],
    });

    const inserted = await db.execute({ sql: `SELECT * FROM coach_templates WHERE id = ? LIMIT 1`, args: [id] });
    res.status(201).json({ data: mapTemplate(inserted.rows[0] as Record<string, unknown>) });
    return;
  }

  res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed.'));
}