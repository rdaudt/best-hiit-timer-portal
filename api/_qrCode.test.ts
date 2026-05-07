import { beforeEach, describe, expect, it, vi } from 'vitest';
import { put } from '@vercel/blob';
import QRCode from 'qrcode';
import { buildCoachPublicUrl, buildQrBlobPath, provisionWorkspaceQrCode } from './_qrCode';

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
}));

vi.mock('qrcode', () => ({
  default: {
    toBuffer: vi.fn(),
  },
}));

describe('qr code provisioning', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('builds public coach url from slug', () => {
    expect(buildCoachPublicUrl('rdaudt')).toBe('https://best-hiit-timer.vercel.app/rdaudt');
    expect(buildCoachPublicUrl('/RDAUDT/')).toBe('https://best-hiit-timer.vercel.app/rdaudt');
  });

  it('builds fixed qr blob path', () => {
    expect(buildQrBlobPath('tenant-1')).toBe('tenants/tenant-1/branding/qr.png');
  });

  it('generates png and uploads to blob', async () => {
    const png = Buffer.from('png-bytes');
    vi.mocked(QRCode.toBuffer).mockResolvedValue(png as never);
    vi.mocked(put).mockResolvedValue({ url: 'https://blob.vercel-storage.com/tenants/tenant-1/branding/qr.png' } as never);

    const result = await provisionWorkspaceQrCode('tenant-1', 'rdaudt');

    expect(QRCode.toBuffer).toHaveBeenCalledWith('https://best-hiit-timer.vercel.app/rdaudt', expect.any(Object));
    expect(put).toHaveBeenCalledWith('tenants/tenant-1/branding/qr.png', png, expect.objectContaining({
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: false,
    }));
    expect(result.url).toBe('https://blob.vercel-storage.com/tenants/tenant-1/branding/qr.png');
  });

  it('retries with private access when store is private', async () => {
    const png = Buffer.from('png-bytes');
    vi.mocked(QRCode.toBuffer).mockResolvedValue(png as never);
    vi.mocked(put)
      .mockRejectedValueOnce(new Error('Vercel Blob: Cannot use public access on a private store. The store is configured with private access.') as never)
      .mockResolvedValueOnce({ url: 'https://abc.private.blob.vercel-storage.com/tenants/tenant-1/branding/qr.png' } as never);

    const result = await provisionWorkspaceQrCode('tenant-1', 'rdaudt');

    expect(vi.mocked(put).mock.calls[0][2]).toMatchObject({ access: 'public' });
    expect(vi.mocked(put).mock.calls[1][2]).toMatchObject({ access: 'private' });
    expect(result.url).toContain('.private.blob.vercel-storage.com/');
  });
});
