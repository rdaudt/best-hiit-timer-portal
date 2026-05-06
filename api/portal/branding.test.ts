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
        slug: 'slug',
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

  it('returns 403 for cross-tenant asset references', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({
      ok: true,
      session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
    } as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn() } as never);

    const res = makeRes();
    await handler({
      method: 'PUT',
      body: {
        slug: 'slug',
        businessName: 'ND',
        coachName: 'Coach',
        bio: '',
        logoUrl: 'https://blob.vercel-storage.com/tenants/w2/branding/logo.png',
        coachPhotoUrl: '',
        qrCodeUrl: '',
        themePrimaryColor: '#ffffff',
        themeSecondaryColor: '#000000',
        brandHeadline: '',
        expectedUpdatedAt: '2026-02-01T00:00:00.000Z',
      },
    }, res as never);

    expect(res.payload.code).toBe(403);
  });

  it('unpublishes branding', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({
      ok: true,
      session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
    } as never);
    const execute = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'w1', slug: 'slug', status: 'draft', published_at: null, updated_at: '2026-01-01T00:00:00.000Z' }] });
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    const res = makeRes();
    await handler({ method: 'POST', query: { action: 'unpublish' } }, res as never);

    expect(res.payload.code).toBe(200);
    expect(execute.mock.calls[0][0].sql).toContain("status = 'draft'");
  });

  it('soft deletes branding', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({
      ok: true,
      session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
    } as never);
    const execute = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'w1', slug: 'slug', status: 'draft', deleted_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }] });
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    const res = makeRes();
    await handler({ method: 'POST', query: { action: 'delete' } }, res as never);

    expect(res.payload.code).toBe(200);
    expect(execute.mock.calls[0][0].sql).toContain('deleted_at = ?');
  });

  it('rejects unsupported POST action', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({
      ok: true,
      session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
    } as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn() } as never);

    const res = makeRes();
    await handler({ method: 'POST', query: { action: 'bad' } }, res as never);
    expect(res.payload.code).toBe(405);
  });
});
