import { getDb } from '../_db.js';
import { requirePortalSession } from '../_portalAuth.js';
import { errorResponse, nowIso, type NodeReq, type NodeRes } from '../_http.js';
import { validateTenantAssetRefs } from '../_assets.js';

type BrandingUpdate = {
  businessName: string;
  coachName: string;
  bio: string;
  logoUrl: string;
  coachPhotoUrl: string;
  coachHeaderImageUrl: string;
  qrCodeUrl: string;
  themePrimaryColor: string;
  themeSecondaryColor: string;
  brandHeadline: string;
  expectedUpdatedAt: string;
};

const asObject = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});
const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function parsePayload(body: unknown): BrandingUpdate {
  const obj = asObject(body);
  return {
    businessName: asString(obj.businessName),
    coachName: asString(obj.coachName),
    bio: asString(obj.bio),
    logoUrl: asString(obj.logoUrl),
    coachPhotoUrl: asString(obj.coachPhotoUrl),
    coachHeaderImageUrl: asString(obj.coachHeaderImageUrl),
    qrCodeUrl: asString(obj.qrCodeUrl),
    themePrimaryColor: asString(obj.themePrimaryColor),
    themeSecondaryColor: asString(obj.themeSecondaryColor),
    brandHeadline: asString(obj.brandHeadline),
    expectedUpdatedAt: asString(obj.expectedUpdatedAt),
  };
}

function validateHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function mapBranding(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    slug: String(row.slug),
    businessName: String(row.business_name ?? ''),
    coachName: String(row.coach_name ?? ''),
    bio: String(row.bio ?? ''),
    logoUrl: String(row.logo_url ?? ''),
    coachPhotoUrl: String(row.coach_photo_url ?? ''),
    coachHeaderImageUrl: String(row.coach_header_image_url ?? ''),
    qrCodeUrl: String(row.qr_code_url ?? ''),
    themePrimaryColor: String(row.theme_primary_color ?? '#f97316'),
    themeSecondaryColor: String(row.theme_secondary_color ?? '#111827'),
    brandHeadline: String(row.brand_headline ?? ''),
    status: String(row.status ?? 'draft'),
    updatedAt: String(row.updated_at ?? ''),
    publishedAt: row.published_at ? String(row.published_at) : null,
    updatedByGoogleSub: row.updated_by_google_sub ? String(row.updated_by_google_sub) : null,
    updatedByEmail: row.updated_by_email ? String(row.updated_by_email) : null,
  };
}

export default async function handler(req: NodeReq, res: NodeRes) {
  const auth = await requirePortalSession(req);
  if (!auth.ok) {
    res.status(auth.status).json(errorResponse('AUTH_REQUIRED', 'Authentication required.'));
    return;
  }

  const db = getDb();

  if (req.method === 'GET') {
    const result = await db.execute({
      sql: `SELECT * FROM coach_tenants WHERE id = ? LIMIT 1`,
      args: [auth.session.workspaceId],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json(errorResponse('WORKSPACE_NOT_FOUND', 'Workspace not found.'));
      return;
    }
    res.status(200).json({ data: mapBranding(row) });
    return;
  }

  if (req.method === 'PUT') {
    const payload = parsePayload(req.body);
    if (!payload.businessName || !payload.coachName) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'businessName and coachName are required.'));
      return;
    }
    if (!validateHexColor(payload.themePrimaryColor) || !validateHexColor(payload.themeSecondaryColor)) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Theme colors must be #RRGGBB.'));
      return;
    }
    if (!validateTenantAssetRefs([payload.logoUrl, payload.coachPhotoUrl, payload.coachHeaderImageUrl, payload.qrCodeUrl], auth.session.workspaceId)) {
      res.status(403).json(errorResponse('TENANT_ASSET_FORBIDDEN', 'Asset references must belong to your workspace storage prefix.'));
      return;
    }

    const current = await db.execute({
      sql: `SELECT updated_at FROM coach_tenants WHERE id = ? LIMIT 1`,
      args: [auth.session.workspaceId],
    });
    const row = current.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json(errorResponse('WORKSPACE_NOT_FOUND', 'Workspace not found.'));
      return;
    }
    if (String(row.updated_at ?? '') !== payload.expectedUpdatedAt) {
      res.status(409).json(errorResponse('CONFLICT', 'Workspace was updated by another session.'));
      return;
    }

    const updatedAt = nowIso();
    await db.execute({
      sql: `
        UPDATE coach_tenants
        SET business_name = ?, coach_name = ?, bio = ?, logo_url = ?, coach_photo_url = ?, coach_header_image_url = ?, qr_code_url = ?,
            theme_primary_color = ?, theme_secondary_color = ?, brand_headline = ?, updated_at = ?,
            updated_by_google_sub = ?, updated_by_email = ?
        WHERE id = ?
      `,
      args: [
        payload.businessName,
        payload.coachName,
        payload.bio,
        payload.logoUrl,
        payload.coachPhotoUrl,
        payload.coachHeaderImageUrl,
        payload.qrCodeUrl,
        payload.themePrimaryColor,
        payload.themeSecondaryColor,
        payload.brandHeadline,
        updatedAt,
        auth.session.sub,
        auth.session.email,
        auth.session.workspaceId,
      ],
    });

    const next = await db.execute({
      sql: `SELECT * FROM coach_tenants WHERE id = ? LIMIT 1`,
      args: [auth.session.workspaceId],
    });
    res.status(200).json({ data: mapBranding(next.rows[0] as Record<string, unknown>) });
    return;
  }

  if (req.method === 'POST') {
    const path = typeof req.query?.action === 'string' ? req.query.action : '';
    if (path !== 'publish') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed.'));
      return;
    }

    const publishedAt = nowIso();
    await db.execute({
      sql: `
        UPDATE coach_tenants
        SET status = 'published', published_at = ?, updated_at = ?, updated_by_google_sub = ?, updated_by_email = ?
        WHERE id = ?
      `,
      args: [publishedAt, publishedAt, auth.session.sub, auth.session.email, auth.session.workspaceId],
    });
    const result = await db.execute({ sql: `SELECT * FROM coach_tenants WHERE id = ? LIMIT 1`, args: [auth.session.workspaceId] });
    res.status(200).json({ data: mapBranding(result.rows[0] as Record<string, unknown>) });
    return;
  }

  res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed.'));
}
