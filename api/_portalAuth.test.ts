import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requirePortalSession } from './_portalAuth';

vi.mock('./_session.js', () => ({
  parseSession: vi.fn(),
}));

vi.mock('./_db.js', () => ({
  createCoachTenantTablesIfNeeded: vi.fn(),
  findWorkspaceByGoogleSub: vi.fn(),
}));

import { parseSession } from './_session.js';
import { createCoachTenantTablesIfNeeded, findWorkspaceByGoogleSub } from './_db.js';

describe('requirePortalSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 403 for soft-deleted workspace', async () => {
    vi.mocked(parseSession).mockReturnValue({ sub: 'sub1', email: 'coach@example.com' } as never);
    vi.mocked(createCoachTenantTablesIfNeeded).mockResolvedValue(undefined);
    vi.mocked(findWorkspaceByGoogleSub).mockResolvedValue({
      workspaceId: 'w1',
      workspaceSlug: 'slug',
      deletedAt: '2026-01-01T00:00:00.000Z',
    } as never);

    const result = await requirePortalSession({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });
});
