import { randomUUID } from 'node:crypto';
import { createAnalyticsTablesIfNeeded, findWorkspaceBySlug, getDb } from '../_db.js';
import { errorResponse, nowIso, type NodeReq, type NodeRes } from '../_http.js';

const asObject = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});
const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const asNumber = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const ALLOWED_EVENTS = new Set([
  'app_opened',
  'timer_created',
  'timer_run_completed',
  'timer_run_incomplete',
  'timer_created_from_template',
]);

function isAuthorized(req: NodeReq) {
  const expected = process.env.ANALYTICS_INGEST_SECRET?.trim();
  if (!expected) {
    return true;
  }
  const auth = req.headers?.authorization;
  return auth === `Bearer ${expected}`;
}

export default async function handler(req: NodeReq, res: NodeRes) {
  if (req.method !== 'POST') {
    res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed.'));
    return;
  }
  if (!isAuthorized(req)) {
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid analytics ingest token.'));
    return;
  }

  const body = asObject(req.body);
  const tenantSlug = asString(body.tenantSlug).toLowerCase();
  const eventName = asString(body.eventName);
  const occurredAt = asString(body.occurredAt) || nowIso();
  const payload = asObject(body.payload);

  if (!tenantSlug || !eventName) {
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'tenantSlug and eventName are required.'));
    return;
  }
  if (!ALLOWED_EVENTS.has(eventName)) {
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'Unsupported eventName.'));
    return;
  }

  await createAnalyticsTablesIfNeeded();
  const workspace = await findWorkspaceBySlug(tenantSlug);
  if (!workspace) {
    res.status(404).json(errorResponse('WORKSPACE_NOT_FOUND', 'Unknown tenant slug.'));
    return;
  }

  const sanitizedPayload = {
    durationSec: asNumber(payload.durationSec),
    stationCount: asNumber(payload.stationCount),
    roundsPerStation: asNumber(payload.roundsPerStation),
    workSec: asNumber(payload.workSec),
    restSec: asNumber(payload.restSec),
  };

  const db = getDb();
  await db.execute({
    sql: `INSERT INTO analytics_events (id, tenant_id, event_name, occurred_at, payload_json) VALUES (?, ?, ?, ?, ?)` ,
    args: [randomUUID(), workspace.workspaceId, eventName, occurredAt, JSON.stringify(sanitizedPayload)],
  });

  res.status(202).json({ ok: true });
}