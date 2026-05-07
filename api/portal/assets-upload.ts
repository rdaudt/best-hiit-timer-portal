import { put } from '@vercel/blob';
import { buildTenantAssetPath, extractPathFromAssetUrl } from '../_assets.js';
import { errorResponse, type NodeReq, type NodeRes } from '../_http.js';
import { requirePortalSession } from '../_portalAuth.js';

const asObject = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});
const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function inferContentType(filename: string, providedType: string) {
  const lowerName = filename.trim().toLowerCase();
  const lowerProvided = providedType.trim().toLowerCase();
  if (lowerName.endsWith('.png')) return { ext: 'png', contentType: 'image/png' };
  if (lowerName.endsWith('.jpg')) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (lowerName.endsWith('.jpeg')) return { ext: 'jpeg', contentType: 'image/jpeg' };
  if (lowerProvided === 'image/png') return { ext: 'png', contentType: 'image/png' };
  if (lowerProvided === 'image/jpeg' || lowerProvided === 'image/jpg') return { ext: 'jpg', contentType: 'image/jpeg' };
  return null;
}

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
  const inferred = inferContentType(filename, asString(body.contentType));
  const dataBase64 = asString(body.dataBase64);

  if (!assetType || !filename || !dataBase64) {
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'assetType, filename and dataBase64 are required.'));
    return;
  }
  if (!inferred) {
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'Only .png, .jpg and .jpeg files are allowed.'));
    return;
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(dataBase64, 'base64');
  } catch {
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid base64 payload.'));
    return;
  }

  const canonicalFilename = `asset.${inferred.ext}`;
  const pathname = buildTenantAssetPath(auth.session.workspaceId, assetType, canonicalFilename);
  let blob;
  try {
    blob = await put(pathname, bytes, { access: 'public', contentType: inferred.contentType, allowOverwrite: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Cannot use public access on a private store')) {
      throw error;
    }
    blob = await put(pathname, bytes, { access: 'private', contentType: inferred.contentType, allowOverwrite: true });
  }

  res.status(201).json({
    data: {
      url: blob.url,
      pathname: extractPathFromAssetUrl(blob.url),
      workspaceId: auth.session.workspaceId,
    },
  });
}
