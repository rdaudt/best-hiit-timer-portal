import { describe, expect, it, vi, beforeEach } from 'vitest';
import handler from './branding';

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

describe('portal branding api', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when auth fails', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({ ok: false, status: 401, body: { error: 'Unauthorized' } } as never);
    const res = makeRes();

    await handler({ method: 'GET' }, res as never);

    expect(res.payload.code).toBe(401);
  });

  it('returns 409 on optimistic concurrency mismatch', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({
      ok: true,
      session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
    } as never);

    vi.mocked(getDb).mockReturnValue({
      execute: vi.fn().mockResolvedValue({ rows: [{ updated_at: '2026-01-01T00:00:00.000Z' }] }),
    } as never);

    const res = makeRes();
    await handler({
      method: 'PUT',
      body: {
        businessName: 'ND',
        coachName: 'Coach',
        bio: '',
        logoUrl: '',
        coachPhotoUrl: '',
        qrCodeUrl: '',
        themePrimaryColor: '#ffffff',
        themeSecondaryColor: '#000000',
        brandHeadline: '',
        expectedUpdatedAt: '2026-02-01T00:00:00.000Z',
      },
    }, res as never);

    expect(res.payload.code).toBe(409);
  });
});