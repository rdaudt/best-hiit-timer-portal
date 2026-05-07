import { describe, expect, it, vi, beforeEach } from 'vitest';
import handler from './branding';

vi.mock('../_portalAuth.js', () => ({
  requirePortalSession: vi.fn(),
}));

vi.mock('../_db.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../_qrCode.js', () => ({
  provisionWorkspaceQrCode: vi.fn(),
}));

import { requirePortalSession } from '../_portalAuth.js';
import { getDb } from '../_db.js';
import { provisionWorkspaceQrCode } from '../_qrCode.js';

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
      execute: vi.fn().mockResolvedValue({ rows: [{ updated_at: '2026-01-01T00:00:00.000Z', slug: 'slug', qr_code_url: '' }] }),
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

  it('does not regenerate qr when slug is unchanged', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({
      ok: true,
      session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
    } as never);
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ updated_at: '2026-01-01T00:00:00.000Z', slug: 'slug', qr_code_url: 'https://blob.vercel-storage.com/tenants/w1/branding/qr.png' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'w1', slug: 'slug', qr_code_url: 'https://blob.vercel-storage.com/tenants/w1/branding/qr.png', updated_at: '2026-01-01T00:00:01.000Z' }] });
    vi.mocked(getDb).mockReturnValue({ execute } as never);

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
        coachHeaderImageUrl: '',
        qrCodeUrl: 'https://blob.vercel-storage.com/tenants/w1/branding/qr.png',
        themePrimaryColor: '#ffffff',
        themeSecondaryColor: '#000000',
        brandHeadline: '',
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      },
    }, res as never);

    expect(res.payload.code).toBe(200);
    expect(provisionWorkspaceQrCode).not.toHaveBeenCalled();
  });

  it('regenerates qr when slug changes', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({
      ok: true,
      session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
    } as never);
    vi.mocked(provisionWorkspaceQrCode).mockResolvedValue({ url: 'https://blob.vercel-storage.com/tenants/w1/branding/qr.png' } as never);
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ updated_at: '2026-01-01T00:00:00.000Z', slug: 'old-slug', qr_code_url: '' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'w1', slug: 'new-slug', qr_code_url: 'https://blob.vercel-storage.com/tenants/w1/branding/qr.png', updated_at: '2026-01-01T00:00:01.000Z' }] });
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    const res = makeRes();
    await handler({
      method: 'PUT',
      body: {
        slug: 'new-slug',
        businessName: 'ND',
        coachName: 'Coach',
        bio: '',
        logoUrl: '',
        coachPhotoUrl: '',
        coachHeaderImageUrl: '',
        qrCodeUrl: '',
        themePrimaryColor: '#ffffff',
        themeSecondaryColor: '#000000',
        brandHeadline: '',
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      },
    }, res as never);

    expect(provisionWorkspaceQrCode).toHaveBeenCalledWith('w1', 'new-slug');
    const updateCall = execute.mock.calls[1][0];
    expect(updateCall.args).toContain('https://blob.vercel-storage.com/tenants/w1/branding/qr.png');
    expect(res.payload.code).toBe(200);
  });

  it('returns 500 when qr regeneration fails for slug change', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({
      ok: true,
      session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
    } as never);
    vi.mocked(provisionWorkspaceQrCode).mockRejectedValue(new Error('qr failed') as never);
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ updated_at: '2026-01-01T00:00:00.000Z', slug: 'old-slug', qr_code_url: '' }] });
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    const res = makeRes();
    await handler({
      method: 'PUT',
      body: {
        slug: 'new-slug',
        businessName: 'ND',
        coachName: 'Coach',
        bio: '',
        logoUrl: '',
        coachPhotoUrl: '',
        coachHeaderImageUrl: '',
        qrCodeUrl: '',
        themePrimaryColor: '#ffffff',
        themeSecondaryColor: '#000000',
        brandHeadline: '',
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      },
    }, res as never);

    expect(res.payload.code).toBe(500);
    expect(execute).toHaveBeenCalledTimes(1);
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

  it('regenerates qr code manually', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({
      ok: true,
      session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
    } as never);
    vi.mocked(provisionWorkspaceQrCode).mockResolvedValue({ url: 'https://blob.vercel-storage.com/tenants/w1/branding/qr.png' } as never);
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ slug: 'slug' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'w1', slug: 'slug', qr_code_url: 'https://blob.vercel-storage.com/tenants/w1/branding/qr.png', updated_at: '2026-01-01T00:00:00.000Z' }] });
    vi.mocked(getDb).mockReturnValue({ execute } as never);

    const res = makeRes();
    await handler({ method: 'POST', query: { action: 'regenerate-qr' } }, res as never);

    expect(provisionWorkspaceQrCode).toHaveBeenCalledWith('w1', 'slug');
    expect(res.payload.code).toBe(200);
  });

  it('persists instagram and tiktok usernames on save', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({
      ok: true,
      session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
    } as never);
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ updated_at: '2026-01-01T00:00:00.000Z', slug: 'slug', qr_code_url: '' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 'w1', slug: 'slug', ig_username: 'coachig', tiktok_username: 'coachtok', updated_at: '2026-01-01T00:00:01.000Z' }] });
    vi.mocked(getDb).mockReturnValue({ execute } as never);

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
        coachHeaderImageUrl: '',
        igUsername: 'coachig',
        tiktokUsername: 'coachtok',
        qrCodeUrl: '',
        themePrimaryColor: '#ffffff',
        themeSecondaryColor: '#000000',
        brandHeadline: '',
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      },
    }, res as never);

    expect(res.payload.code).toBe(200);
    const updateCall = execute.mock.calls[1][0];
    expect(updateCall.args).toContain('coachig');
    expect(updateCall.args).toContain('coachtok');
  });
});
