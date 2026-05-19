import { describe, expect, it, vi, beforeEach } from 'vitest';
import handler from './templates';

vi.mock('../_portalAuth.js', () => ({
  requirePortalSession: vi.fn(),
}));

vi.mock('../_db.js', () => ({
  getDb: vi.fn(),
}));

import { requirePortalSession } from '../_portalAuth.js';
import { getDb } from '../_db.js';

function makeRes() {
  const payload: { code?: number; body?: unknown } = {};
  return {
    payload,
    status(code: number) {
      payload.code = code;
      return {
        json(body: unknown) {
          payload.body = body;
        },
      };
    },
  };
}

const mockSession = {
  ok: true,
  session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
};

describe('portal templates api', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects invalid create payload', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn() } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { name: '', stationCount: 0 } }, res as never);

    expect(res.payload.code).toBe(400);
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({ ok: false, status: 401 } as never);

    const res = makeRes();
    await handler({ method: 'GET' }, res as never);

    expect(res.payload.code).toBe(401);
  });

  it('returns 405 for unsupported method with id', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    const row = { id: 't1', tenant_id: 'w1', name: 'T', station_count: 1, station_workout_types_json: '[]', rounds_per_station: 1, work_minutes: 0, work_seconds: 30, rest_minutes: 0, rest_seconds: 15, station_transition_minutes: 0, station_transition_seconds: 15, start_station_work_manually: 0, warmup_enabled: 0, warmup_minutes: 0, warmup_seconds: 0, cooldown_enabled: 0, cooldown_minutes: 0, cooldown_seconds: 0, status: 'draft', sort_order: 0, created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', published_at: null, archived_at: null, updated_by_google_sub: null, updated_by_email: null };
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn().mockResolvedValue({ rows: [row] }) } as never);

    const res = makeRes();
    await handler({ method: 'DELETE', query: { id: 't1' } }, res as never);

    expect(res.payload.code).toBe(405);
  });

  it('returns 404 for unknown template id', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    const mockExecute = vi.fn().mockResolvedValue({ rows: [] });
    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { id: 'nonexistent' } }, res as never);

    expect(res.payload.code).toBe(404);
  });

  it('returns 409 on PUT with stale expectedUpdatedAt', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    const row = { id: 't1', tenant_id: 'w1', name: 'My Template', station_count: 3, station_workout_types_json: '[]', rounds_per_station: 1, work_minutes: 0, work_seconds: 30, rest_minutes: 0, rest_seconds: 15, station_transition_minutes: 0, station_transition_seconds: 15, start_station_work_manually: 0, warmup_enabled: 0, warmup_minutes: 0, warmup_seconds: 0, cooldown_enabled: 0, cooldown_minutes: 0, cooldown_seconds: 0, status: 'draft', sort_order: 0, created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z', published_at: null, archived_at: null, updated_by_google_sub: null, updated_by_email: null };
    const mockExecute = vi.fn().mockResolvedValue({ rows: [row] });
    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as never);

    const res = makeRes();
    await handler({
      method: 'PUT',
      query: { id: 't1' },
      body: { name: 'Updated', stationCount: 3, roundsPerStation: 1, expectedUpdatedAt: 'stale-timestamp' },
    }, res as never);

    expect(res.payload.code).toBe(409);
  });
});
