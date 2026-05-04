import { createAnalyticsTablesIfNeeded, getDb } from '../_db.js';
import { errorResponse, nowIso, type NodeReq, type NodeRes } from '../_http.js';

const CRON_HEADER = 'authorization';

function isAuthorized(req: NodeReq) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return false;
  }
  const header = req.headers?.[CRON_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return value === `Bearer ${expected}`;
}

function toUtcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function handler(req: NodeReq, res: NodeRes) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed.'));
    return;
  }
  if (!isAuthorized(req)) {
    res.status(401).json(errorResponse('UNAUTHORIZED', 'Invalid cron token.'));
    return;
  }

  await createAnalyticsTablesIfNeeded();
  const db = getDb();

  const targetDate = new Date();
  targetDate.setUTCDate(targetDate.getUTCDate() - 1);
  const dayUtc = toUtcDay(targetDate);
  const start = `${dayUtc}T00:00:00.000Z`;
  const end = `${dayUtc}T23:59:59.999Z`;

  const rows = await db.execute({
    sql: `
      SELECT tenant_id, event_name, payload_json, COUNT(*) AS c
      FROM analytics_events
      WHERE occurred_at >= ? AND occurred_at <= ?
      GROUP BY tenant_id, event_name, payload_json
    `,
    args: [start, end],
  });

  const byTenant = new Map<string, Record<string, number>>();
  for (const raw of rows.rows) {
    const row = raw as Record<string, unknown>;
    const tenantId = String(row.tenant_id);
    const eventName = String(row.event_name);
    const count = Number(row.c ?? 0);
    const payloadRaw = String(row.payload_json ?? '{}');
    const payload = JSON.parse(payloadRaw) as Record<string, unknown>;
    const current = byTenant.get(tenantId) ?? {
      app_opened_count: 0,
      timer_created_count: 0,
      timer_run_completed_count: 0,
      timer_run_incomplete_count: 0,
      timer_created_from_template_count: 0,
      total_timer_duration_sec_sum: 0,
      station_count_sum: 0,
      rounds_per_station_sum: 0,
      work_sec_sum: 0,
      rest_sec_sum: 0,
    };

    if (eventName === 'app_opened') current.app_opened_count += count;
    if (eventName === 'timer_created') current.timer_created_count += count;
    if (eventName === 'timer_run_completed') {
      current.timer_run_completed_count += count;
      current.total_timer_duration_sec_sum += Number(payload.durationSec ?? 0) * count;
      current.station_count_sum += Number(payload.stationCount ?? 0) * count;
      current.rounds_per_station_sum += Number(payload.roundsPerStation ?? 0) * count;
      current.work_sec_sum += Number(payload.workSec ?? 0) * count;
      current.rest_sec_sum += Number(payload.restSec ?? 0) * count;
    }
    if (eventName === 'timer_run_incomplete') current.timer_run_incomplete_count += count;
    if (eventName === 'timer_created_from_template') current.timer_created_from_template_count += count;

    byTenant.set(tenantId, current);
  }

  const now = nowIso();
  for (const [tenantId, totals] of byTenant.entries()) {
    await db.execute({
      sql: `
        INSERT INTO analytics_rollup_daily (
          tenant_id, day_utc, app_opened_count, timer_created_count, timer_run_completed_count,
          timer_run_incomplete_count, timer_created_from_template_count, total_timer_duration_sec_sum,
          station_count_sum, rounds_per_station_sum, work_sec_sum, rest_sec_sum, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, day_utc) DO UPDATE SET
          app_opened_count = excluded.app_opened_count,
          timer_created_count = excluded.timer_created_count,
          timer_run_completed_count = excluded.timer_run_completed_count,
          timer_run_incomplete_count = excluded.timer_run_incomplete_count,
          timer_created_from_template_count = excluded.timer_created_from_template_count,
          total_timer_duration_sec_sum = excluded.total_timer_duration_sec_sum,
          station_count_sum = excluded.station_count_sum,
          rounds_per_station_sum = excluded.rounds_per_station_sum,
          work_sec_sum = excluded.work_sec_sum,
          rest_sec_sum = excluded.rest_sec_sum,
          updated_at = excluded.updated_at
      `,
      args: [
        tenantId,
        dayUtc,
        totals.app_opened_count,
        totals.timer_created_count,
        totals.timer_run_completed_count,
        totals.timer_run_incomplete_count,
        totals.timer_created_from_template_count,
        totals.total_timer_duration_sec_sum,
        totals.station_count_sum,
        totals.rounds_per_station_sum,
        totals.work_sec_sum,
        totals.rest_sec_sum,
        now,
      ],
    });
  }

  res.status(200).json({ ok: true, dayUtc, tenantsProcessed: byTenant.size });
}