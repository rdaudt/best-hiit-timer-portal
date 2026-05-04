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

describe('portal templates api', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects invalid create payload', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({
      ok: true,
      session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
    } as never);

    vi.mocked(getDb).mockReturnValue({ execute: vi.fn() } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { name: '', stationCount: 0 } }, res as never);

    expect(res.payload.code).toBe(400);
  });
});