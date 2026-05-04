import { put } from '@vercel/blob';
import { buildTenantAssetPath, extractPathFromAssetUrl } from '../_assets.js';
import { errorResponse, type NodeReq, type NodeRes } from '../_http.js';
import { requirePortalSession } from '../_portalAuth.js';

const asObject = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});
const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export default async function handler(req: NodeReq, res: NodeRes) {
  if (req.method !== 'POST') {
    res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed.'));
    return;
  }

  const auth = await requirePortalSession(req);
  if (!auth.ok) {
    res.status(auth.status).json(errorResponse('AUTH_REQUIRED', 'Authentication required.'));
    return;
  }

  const body = asObject(req.body);
  const assetType = asString(body.assetType);
  const filename = asString(body.filename);
  const contentType = asString(body.contentType) || 'application/octet-stream';
  const dataBase64 = asString(body.dataBase64);

  if (!assetType || !filename || !dataBase64) {
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'assetType, filename and dataBase64 are required.'));
    return;
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(dataBase64, 'base64');
  } catch {
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid base64 payload.'));
    return;
  }

  const pathname = buildTenantAssetPath(auth.session.workspaceId, assetType, filename);
  const blob = await put(pathname, bytes, { access: 'public', contentType });

  res.status(201).json({
    data: {
      url: blob.url,
      pathname: extractPathFromAssetUrl(blob.url),
      workspaceId: auth.session.workspaceId,
    },
  });
}