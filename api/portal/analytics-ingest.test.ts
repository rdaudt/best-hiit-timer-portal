import { describe, expect, it, vi, beforeEach } from 'vitest';
import handler from './analytics-ingest';

vi.mock('../_db.js', () => ({
  createAnalyticsTablesIfNeeded: vi.fn(),
  findWorkspaceBySlug: vi.fn(),
  getDb: vi.fn(),
}));

import { findWorkspaceBySlug, getDb } from '../_db.js';

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

describe('analytics ingest', () => {
  beforeEach(() => vi.resetAllMocks());

  it('rejects unsupported events', async () => {
    const res = makeRes();
    await handler({ method: 'POST', body: { tenantSlug: 'abc', eventName: 'bad' } }, res as never);
    expect(res.payload.code).toBe(400);
  });

  it('writes event for resolved tenant', async () => {
    vi.mocked(findWorkspaceBySlug).mockResolvedValue({ workspaceId: 'tenant-1', workspaceSlug: 'abc' } as never);
    const execute = vi.fn().mockResolvedValue({});
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { tenantSlug: 'abc', eventName: 'app_opened' } }, res as never);
    expect(execute).toHaveBeenCalled();
    expect(res.payload.code).toBe(202);
  });

  it('returns 404 when tenant is not active', async () => {
    vi.mocked(findWorkspaceBySlug).mockResolvedValue(null);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn() } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { tenantSlug: 'abc', eventName: 'app_opened' } }, res as never);
    expect(res.payload.code).toBe(404);
  });
});
