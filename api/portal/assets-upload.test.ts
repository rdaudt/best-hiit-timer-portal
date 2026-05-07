import { describe, expect, it, vi, beforeEach } from 'vitest';
import handler from './assets-upload';

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
}));

vi.mock('../_portalAuth.js', () => ({
  requirePortalSession: vi.fn(),
}));

import { put } from '@vercel/blob';
import { requirePortalSession } from '../_portalAuth.js';

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

describe('portal assets upload api', () => {
  beforeEach(() => vi.resetAllMocks());

  it('denies unauthenticated upload', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({ ok: false, status: 401 } as never);
    const res = makeRes();

    await handler({ method: 'POST', body: {} }, res as never);

    expect(res.payload.code).toBe(401);
  });

  it('uploads into tenant prefix', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({ ok: true, session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 's', email: 'e' } } as never);
    vi.mocked(put).mockResolvedValue({ url: 'https://blob.vercel-storage.com/tenants/w1/branding/abc-logo.png' } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { assetType: 'branding', filename: 'logo.png', contentType: 'image/png', dataBase64: Buffer.from('abc').toString('base64') } }, res as never);

    expect(res.payload.code).toBe(201);
    expect(vi.mocked(put).mock.calls[0]?.[0]).toBe('tenants/w1/branding/asset.png');
    expect(vi.mocked(put).mock.calls[0]?.[2]).toMatchObject({ allowOverwrite: true });
  });

  it('falls back to private access for private stores', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({ ok: true, session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 's', email: 'e' } } as never);
    vi.mocked(put)
      .mockRejectedValueOnce(new Error('Vercel Blob: Cannot use public access on a private store. The store is configured with private access.') as never)
      .mockResolvedValueOnce({ url: 'https://store.private.blob.vercel-storage.com/tenants/w1/branding/abc-logo.png' } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { assetType: 'branding', filename: 'logo.png', contentType: 'image/png', dataBase64: Buffer.from('abc').toString('base64') } }, res as never);

    expect(res.payload.code).toBe(201);
    expect(vi.mocked(put).mock.calls[0][2]).toMatchObject({ access: 'public', allowOverwrite: true });
    expect(vi.mocked(put).mock.calls[1][2]).toMatchObject({ access: 'private', allowOverwrite: true });
  });

  it('infers image/png content type when browser omits type', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({ ok: true, session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 's', email: 'e' } } as never);
    vi.mocked(put).mockResolvedValue({ url: 'https://blob.vercel-storage.com/tenants/w1/logo/asset.png' } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { assetType: 'logo', filename: 'logo.png', contentType: '', dataBase64: Buffer.from('abc').toString('base64') } }, res as never);

    expect(res.payload.code).toBe(201);
    expect(vi.mocked(put).mock.calls[0]?.[0]).toBe('tenants/w1/logo/asset.png');
    expect(vi.mocked(put).mock.calls[0][2]).toMatchObject({ contentType: 'image/png' });
  });

  it('infers image/jpeg content type when provided octet-stream', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({ ok: true, session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 's', email: 'e' } } as never);
    vi.mocked(put).mockResolvedValue({ url: 'https://blob.vercel-storage.com/tenants/w1/logo/asset.jpeg' } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { assetType: 'logo', filename: 'logo.jpeg', contentType: 'application/octet-stream', dataBase64: Buffer.from('abc').toString('base64') } }, res as never);

    expect(res.payload.code).toBe(201);
    expect(vi.mocked(put).mock.calls[0]?.[0]).toBe('tenants/w1/logo/asset.jpeg');
    expect(vi.mocked(put).mock.calls[0][2]).toMatchObject({ contentType: 'image/jpeg' });
  });

  it('rejects unsupported file extensions', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({ ok: true, session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 's', email: 'e' } } as never);
    const res = makeRes();

    await handler({ method: 'POST', body: { assetType: 'logo', filename: 'logo.webp', contentType: 'image/webp', dataBase64: Buffer.from('abc').toString('base64') } }, res as never);

    expect(res.payload.code).toBe(400);
    expect(vi.mocked(put)).not.toHaveBeenCalled();
  });
});
