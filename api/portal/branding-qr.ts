import { getDb } from '../_db.js';
import { errorResponse } from '../_http.js';
import { requirePortalSession } from '../_portalAuth.js';

type NodeReq = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type NodeRes = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => { json: (body: unknown) => void };
  end: (body?: string | Buffer) => void;
};

const asString = (value: unknown) => (typeof value === 'string' ? value : '');

export default async function handler(req: NodeReq, res: NodeRes) {
  if (req.method !== 'GET') {
    res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed.'));
    return;
  }

  const auth = await requirePortalSession(req);
  if (!auth.ok) {
    res.status(auth.status).json(errorResponse('AUTH_REQUIRED', 'Authentication required.'));
    return;
  }

  const db = getDb();
  const result = await db.execute({
    sql: `SELECT qr_code_url FROM coach_tenants WHERE id = ? LIMIT 1`,
    args: [auth.session.workspaceId],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json(errorResponse('WORKSPACE_NOT_FOUND', 'Workspace not found.'));
    return;
  }

  const qrCodeUrl = asString(row.qr_code_url).trim();
  if (!qrCodeUrl) {
    res.status(404).json(errorResponse('QR_CODE_NOT_FOUND', 'QR code not found.'));
    return;
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const upstream = await fetch(qrCodeUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!upstream.ok) {
    res.status(502).json(errorResponse('QR_CODE_FETCH_FAILED', 'Failed to fetch QR code image from storage.'));
    return;
  }

  const bytes = Buffer.from(await upstream.arrayBuffer());
  res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/png');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.end(bytes);
}
