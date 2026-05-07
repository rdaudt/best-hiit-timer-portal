import { getDb } from '../_db.js';
import { requirePortalSession } from '../_portalAuth.js';
import { errorResponse, nowIso, type NodeReq, type NodeRes } from '../_http.js';
import { isTenantOwnedAsset, validateTenantAssetRefs } from '../_assets.js';
import { provisionWorkspaceQrCode } from '../_qrCode.js';

type BrandingUpdate = {
  slug: string;
  businessName: string;
  coachName: string;
  bio: string;
  logoUrl: string;
  coachPhotoUrl: string;
  coachHeaderImageUrl: string;
  igUsername: string;
  tiktokUsername: string;
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
    slug: asString(obj.slug).toLowerCase(),
    businessName: asString(obj.businessName),
    coachName: asString(obj.coachName),
    bio: asString(obj.bio),
    logoUrl: asString(obj.logoUrl),
    coachPhotoUrl: asString(obj.coachPhotoUrl),
    coachHeaderImageUrl: asString(obj.coachHeaderImageUrl),
    igUsername: asString(obj.igUsername),
    tiktokUsername: asString(obj.tiktokUsername),
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

function validateSlug(value: string) {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(value);
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
    igUsername: String(row.ig_username ?? ''),
    tiktokUsername: String(row.tiktok_username ?? ''),
    qrCodeUrl: String(row.qr_code_url ?? ''),
    themePrimaryColor: String(row.theme_primary_color ?? '#f97316'),
    themeSecondaryColor: String(row.theme_secondary_color ?? '#111827'),
    brandHeadline: String(row.brand_headline ?? ''),
    status: String(row.status ?? 'draft'),
    updatedAt: String(row.updated_at ?? ''),
    publishedAt: row.published_at ? String(row.published_at) : null,
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
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
    const action = typeof req.query?.action === 'string' ? req.query.action : '';
    if (action === 'asset-image') {
      const url = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
      if (!url) {
        res.status(400).json(errorResponse('VALIDATION_ERROR', 'url is required.'));
        return;
      }
      if (!isTenantOwnedAsset(url, auth.session.workspaceId)) {
        res.status(403).json(errorResponse('TENANT_ASSET_FORBIDDEN', 'Asset reference must belong to your workspace storage prefix.'));
        return;
      }
      const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
      const upstream = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!upstream.ok) {
        res.status(502).json(errorResponse('ASSET_FETCH_FAILED', 'Failed to fetch asset image from storage.'));
        return;
      }
      const bytes = Buffer.from(await upstream.arrayBuffer());
      res.setHeader?.('Content-Type', upstream.headers.get('content-type') ?? 'image/png');
      res.setHeader?.('Cache-Control', 'private, max-age=60');
      res.end?.(bytes);
      return;
    }

    const result = await db.execute({
      sql: `SELECT * FROM coach_tenants WHERE id = ? LIMIT 1`,
      args: [auth.session.workspaceId],
    });
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json(errorResponse('WORKSPACE_NOT_FOUND', 'Workspace not found.'));
      return;
    }
    if (action === 'qr-image') {
      const qrCodeUrl = asString(row.qr_code_url);
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
      res.setHeader?.('Content-Type', upstream.headers.get('content-type') ?? 'image/png');
      res.setHeader?.('Cache-Control', 'private, max-age=60');
      res.end?.(bytes);
      return;
    }
    res.status(200).json({ data: mapBranding(row) });
    return;
  }

  if (req.method === 'PUT') {
    const payload = parsePayload(req.body);
    if (!payload.businessName || !payload.coachName || !payload.slug) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'slug, businessName and coachName are required.'));
      return;
    }
    if (!validateSlug(payload.slug)) {
      res.status(400).json(errorResponse('VALIDATION_ERROR', 'Slug must be 3-40 chars lowercase letters, numbers, and hyphens.'));
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
      sql: `SELECT updated_at, slug, qr_code_url FROM coach_tenants WHERE id = ? LIMIT 1`,
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

    let qrCodeUrl = payload.qrCodeUrl;
    const previousSlug = String(row.slug ?? '').toLowerCase();
    const nextSlug = payload.slug.toLowerCase();
    if (previousSlug !== nextSlug) {
      try {
        const qr = await provisionWorkspaceQrCode(auth.session.workspaceId, nextSlug);
        qrCodeUrl = qr.url;
      } catch (error) {
        console.error('workspace qr regeneration failed', {
          workspaceId: auth.session.workspaceId,
          previousSlug,
          nextSlug,
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json(errorResponse('QR_CODE_GENERATION_FAILED', 'Failed to generate QR code for updated slug.'));
        return;
      }
    }

    const updatedAt = nowIso();
    try {
      await db.execute({
      sql: `
        UPDATE coach_tenants
        SET slug = ?, business_name = ?, coach_name = ?, bio = ?, logo_url = ?, coach_photo_url = ?, coach_header_image_url = ?, ig_username = ?, tiktok_username = ?, qr_code_url = ?,
            theme_primary_color = ?, theme_secondary_color = ?, brand_headline = ?, updated_at = ?,
            updated_by_google_sub = ?, updated_by_email = ?
        WHERE id = ?
      `,
      args: [
        payload.slug,
        payload.businessName,
        payload.coachName,
        payload.bio,
        payload.logoUrl,
        payload.coachPhotoUrl,
        payload.coachHeaderImageUrl,
        payload.igUsername,
        payload.tiktokUsername,
        qrCodeUrl,
        payload.themePrimaryColor,
        payload.themeSecondaryColor,
        payload.brandHeadline,
        updatedAt,
        auth.session.sub,
        auth.session.email,
        auth.session.workspaceId,
      ],
    });
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed: coach_tenants.slug')) {
        res.status(409).json(errorResponse('CONFLICT', 'Slug is not available.'));
        return;
      }
      throw error;
    }

    const next = await db.execute({
      sql: `SELECT * FROM coach_tenants WHERE id = ? LIMIT 1`,
      args: [auth.session.workspaceId],
    });
    res.status(200).json({ data: mapBranding(next.rows[0] as Record<string, unknown>) });
    return;
  }

  if (req.method === 'POST') {
    const action = typeof req.query?.action === 'string' ? req.query.action : '';
    if (action !== 'publish' && action !== 'unpublish' && action !== 'delete' && action !== 'regenerate-qr') {
      res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed.'));
      return;
    }

    if (action === 'regenerate-qr') {
      const current = await db.execute({
        sql: `SELECT slug FROM coach_tenants WHERE id = ? LIMIT 1`,
        args: [auth.session.workspaceId],
      });
      const row = current.rows[0] as Record<string, unknown> | undefined;
      if (!row) {
        res.status(404).json(errorResponse('WORKSPACE_NOT_FOUND', 'Workspace not found.'));
        return;
      }

      const slug = String(row.slug ?? '').toLowerCase();
      try {
        const qr = await provisionWorkspaceQrCode(auth.session.workspaceId, slug);
        const actionAt = nowIso();
        await db.execute({
          sql: `
            UPDATE coach_tenants
            SET qr_code_url = ?, updated_at = ?, updated_by_google_sub = ?, updated_by_email = ?
            WHERE id = ?
          `,
          args: [qr.url, actionAt, auth.session.sub, auth.session.email, auth.session.workspaceId],
        });
      } catch (error) {
        console.error('workspace qr regeneration failed', {
          workspaceId: auth.session.workspaceId,
          slug,
          error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json(errorResponse('QR_CODE_GENERATION_FAILED', 'Failed to generate QR code.'));
        return;
      }
    }

    const actionAt = nowIso();
    if (action === 'publish') {
      await db.execute({
        sql: `
          UPDATE coach_tenants
          SET status = 'published', published_at = ?, updated_at = ?, updated_by_google_sub = ?, updated_by_email = ?
          WHERE id = ?
        `,
        args: [actionAt, actionAt, auth.session.sub, auth.session.email, auth.session.workspaceId],
      });
    }
    if (action === 'unpublish') {
      await db.execute({
        sql: `
          UPDATE coach_tenants
          SET status = 'draft', published_at = NULL, updated_at = ?, updated_by_google_sub = ?, updated_by_email = ?
          WHERE id = ?
        `,
        args: [actionAt, auth.session.sub, auth.session.email, auth.session.workspaceId],
      });
    }
    if (action === 'delete') {
      await db.execute({
        sql: `
          UPDATE coach_tenants
          SET deleted_at = ?, deleted_by_google_sub = ?, deleted_by_email = ?, updated_at = ?, updated_by_google_sub = ?, updated_by_email = ?
          WHERE id = ?
        `,
        args: [actionAt, auth.session.sub, auth.session.email, actionAt, auth.session.sub, auth.session.email, auth.session.workspaceId],
      });
    }

    const result = await db.execute({ sql: `SELECT * FROM coach_tenants WHERE id = ? LIMIT 1`, args: [auth.session.workspaceId] });
    res.status(200).json({ data: mapBranding(result.rows[0] as Record<string, unknown>) });
    return;
  }

  res.status(405).json(errorResponse('METHOD_NOT_ALLOWED', 'Method not allowed.'));
}
