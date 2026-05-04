import { createAnalyticsTablesIfNeeded, getDb } from '../_db.js';
import { errorResponse, type NodeReq, type NodeRes } from '../_http.js';
import { requirePortalSession } from '../_portalAuth.js';

const asNumber = (value: unknown) => {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
};

export default async function handler(req: NodeReq, res: NodeRes) {
  if (req.method !== 'GET') {
    res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed.'));
    return;
  }

  const auth = await requirePortalSession(req);
  if (!auth.ok) {
    res.status(auth.status).json(errorResponse('AUTH_REQUIRED', 'Authentication required.'));
    return;
  }

  await createAnalyticsTablesIfNeeded();
  const db = getDb();

  const dateFrom = typeof req.query?.dateFrom === 'string' ? req.query.dateFrom : '';
  const dateTo = typeof req.query?.dateTo === 'string' ? req.query.dateTo : '';
  const hasRange = /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) && /^\d{4}-\d{2}-\d{2}$/.test(dateTo);

  const sql = hasRange
    ? `SELECT * FROM analytics_rollup_daily WHERE tenant_id = ? AND day_utc >= ? AND day_utc <= ? ORDER BY day_utc ASC`
    : `SELECT * FROM analytics_rollup_daily WHERE tenant_id = ? ORDER BY day_utc ASC`;
  const args = hasRange ? [auth.session.workspaceId, dateFrom, dateTo] : [auth.session.workspaceId];

  const result = await db.execute({ sql, args });

  const totals = {
    appOpened: 0,
    timersCreated: 0,
    timerRunsCompleted: 0,
    timerRunsIncomplete: 0,
    timersCreatedFromTemplates: 0,
    totalTimerDurationSec: 0,
    stationCountSum: 0,
    roundsPerStationSum: 0,
    workSecSum: 0,
    restSecSum: 0,
  };

  const trend = result.rows.map((raw) => {
    const row = raw as Record<string, unknown>;
    totals.appOpened += asNumber(row.app_opened_count);
    totals.timersCreated += asNumber(row.timer_created_count);
    totals.timerRunsCompleted += asNumber(row.timer_run_completed_count);
    totals.timerRunsIncomplete += asNumber(row.timer_run_incomplete_count);
    totals.timersCreatedFromTemplates += asNumber(row.timer_created_from_template_count);
    totals.totalTimerDurationSec += asNumber(row.total_timer_duration_sec_sum);
    totals.stationCountSum += asNumber(row.station_count_sum);
    totals.roundsPerStationSum += asNumber(row.rounds_per_station_sum);
    totals.workSecSum += asNumber(row.work_sec_sum);
    totals.restSecSum += asNumber(row.rest_sec_sum);
    return {
      dayUtc: String(row.day_utc),
      appOpened: asNumber(row.app_opened_count),
      runsCompleted: asNumber(row.timer_run_completed_count),
      runsIncomplete: asNumber(row.timer_run_incomplete_count),
    };
  });

  const completed = totals.timerRunsCompleted || 1;
  res.status(200).json({
    data: {
      totals,
      averages: {
        timerDurationSec: totals.totalTimerDurationSec / completed,
        stationCount: totals.stationCountSum / completed,
        roundsPerStation: totals.roundsPerStationSum / completed,
        workSec: totals.workSecSum / completed,
        restSec: totals.restSecSum / completed,
      },
      trend,
    },
  });
}