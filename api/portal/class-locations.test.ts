import { describe, expect, it, vi, beforeEach } from 'vitest';
import handler from './class-locations';

vi.mock('../_portalAuth.js', () => ({
  requirePortalSession: vi.fn(),
}));

vi.mock('../_db.js', () => ({
  getDb: vi.fn(),
}));

vi.mock('../_assets.js', () => ({
  validateTenantAssetRefs: vi.fn(),
}));

import { requirePortalSession } from '../_portalAuth.js';
import { getDb } from '../_db.js';
import { validateTenantAssetRefs } from '../_assets.js';

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

const mockSession = {
  ok: true,
  session: { workspaceId: 'w1', workspaceSlug: 'slug', sub: 'sub1', email: 'coach@example.com' },
};

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'loc1',
  tenant_id: 'w1',
  business_name: 'Infinity Fitness',
  location_name: 'Mission, BC',
  logo_url: '',
  is_default: 0,
  sort_order: 0,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  updated_by_google_sub: null,
  updated_by_email: null,
  ...overrides,
});

describe('portal class-locations api', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(validateTenantAssetRefs).mockReturnValue(true);
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue({ ok: false, status: 401 } as never);

    const res = makeRes();
    await handler({ method: 'GET' }, res as never);

    expect(res.payload.code).toBe(401);
  });

  it('returns empty list when no locations', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn().mockResolvedValue({ rows: [] }) } as never);

    const res = makeRes();
    await handler({ method: 'GET' }, res as never);

    expect(res.payload.code).toBe(200);
    expect((res.payload.body as { data: unknown[] }).data).toHaveLength(0);
  });

  it('rejects create with missing businessName', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn() } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { businessName: '', locationName: 'Mission, BC' } }, res as never);

    expect(res.payload.code).toBe(400);
  });

  it('rejects create with missing locationName', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn() } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { businessName: 'Infinity Fitness', locationName: '' } }, res as never);

    expect(res.payload.code).toBe(400);
  });

  it('rejects create with logoUrl from another workspace', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn() } as never);
    vi.mocked(validateTenantAssetRefs).mockReturnValue(false);

    const res = makeRes();
    await handler({ method: 'POST', body: { businessName: 'Infinity Fitness', locationName: 'Mission, BC', logoUrl: 'https://blob.vercel.com/tenants/other-workspace/logo.png' } }, res as never);

    expect(res.payload.code).toBe(400);
  });

  it('returns 409 on duplicate location', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    const mockExecute = vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed: coach_class_locations'));
    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { businessName: 'Infinity Fitness', locationName: 'Mission, BC' } }, res as never);

    expect(res.payload.code).toBe(409);
    expect((res.payload.body as { error: { code: string } }).error.code).toBe('DUPLICATE_LOCATION');
  });

  it('returns 404 for unknown location id on GET', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn().mockResolvedValue({ rows: [] }) } as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { id: 'nonexistent' } }, res as never);

    expect(res.payload.code).toBe(404);
  });

  it('returns 404 when PUT targets another tenant location', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn().mockResolvedValue({ rows: [] }) } as never);

    const res = makeRes();
    await handler({ method: 'PUT', query: { id: 'other-tenant-loc' }, body: { businessName: 'Infinity Fitness', locationName: 'Mission, BC' } }, res as never);

    expect(res.payload.code).toBe(404);
  });

  it('returns 404 when DELETE targets unknown id', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn().mockResolvedValue({ rows: [] }) } as never);

    const res = makeRes();
    await handler({ method: 'DELETE', query: { id: 'nonexistent' } }, res as never);

    expect(res.payload.code).toBe(404);
  });

  it('deletes existing location', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    const row = makeRow();
    const mockExecute = vi.fn()
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });
    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as never);

    const res = makeRes();
    await handler({ method: 'DELETE', query: { id: 'loc1' } }, res as never);

    expect(res.payload.code).toBe(200);
  });

  it('accepts empty logoUrl on create', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    const row = makeRow();
    const mockExecute = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [row] });
    vi.mocked(getDb).mockReturnValue({ execute: mockExecute } as never);

    const res = makeRes();
    await handler({ method: 'POST', body: { businessName: 'Infinity Fitness', locationName: 'Mission, BC', logoUrl: '' } }, res as never);

    expect(res.payload.code).toBe(201);
  });

  it('returns 405 for unsupported method', async () => {
    vi.mocked(requirePortalSession).mockResolvedValue(mockSession as never);
    vi.mocked(getDb).mockReturnValue({ execute: vi.fn() } as never);

    const res = makeRes();
    await handler({ method: 'OPTIONS', query: { id: 'loc1' } }, res as never);

    expect(res.payload.code).toBe(405);
  });
});
