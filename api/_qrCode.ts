import { put } from '@vercel/blob';
import QRCode from 'qrcode';

const QR_BASE_URL = 'https://best-hiit-timer.vercel.app/';

const normalizeSlug = (slug: string) => slug.trim().toLowerCase().replace(/^\/+|\/+$/g, '');

export function buildCoachPublicUrl(slug: string) {
  const normalized = normalizeSlug(slug);
  return `${QR_BASE_URL}${normalized}`;
}

export function buildQrBlobPath(workspaceId: string) {
  return `tenants/${workspaceId}/branding/qr.png`;
}

export async function provisionWorkspaceQrCode(workspaceId: string, slug: string) {
  const targetUrl = buildCoachPublicUrl(slug);
  const png = await QRCode.toBuffer(targetUrl, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 512,
  });
  const pathname = buildQrBlobPath(workspaceId);
  let blob;
  try {
    blob = await put(pathname, png, {
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Cannot use public access on a private store')) {
      throw error;
    }
    blob = await put(pathname, png, {
      access: 'private',
      contentType: 'image/png',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }

  return {
    targetUrl,
    pathname,
    url: blob.url,
  };
}
