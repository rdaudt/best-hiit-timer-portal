import { describe, expect, it, vi, beforeEach } from 'vitest';
import handler from './analytics-summary';

vi.mock('../_portalAuth.js', () => ({ requirePortalSession: vi.fn() }));
vi.mock('../_db.js', () => ({
  createAnalyticsTablesIfNeeded: vi.fn(),
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
      return { json(body: unknown) { payload.body = body; } };
    },
  };
}

describe('analytics summary', () => {
  beforeEach(() => vi.resetAllMocks());

  it('requires auth', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({ ok: false, status: 401 } as never);
    const res = makeRes();
    await handler({ method: 'GET' }, res as never);
    expect(res.payload.code).toBe(401);
  });

  it('queries by session workspace id only', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({ ok: true, session: { workspaceId: 'tenant-a' } } as never);
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { dateFrom: '2026-01-01', dateTo: '2026-01-07' } }, res as never);

    const call = execute.mock.calls[0][0];
    expect(call.args[0]).toBe('tenant-a');
    expect(res.payload.code).toBe(200);
  });
});