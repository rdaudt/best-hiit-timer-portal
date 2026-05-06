import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './callback';

vi.mock('../_oidc.js', () => ({
  exchangeCodeForIdentity: vi.fn(),
}));

vi.mock('../_db.js', () => ({
  createCoachTenantTablesIfNeeded: vi.fn(),
  createWorkspaceForOwner: vi.fn(),
  findWorkspaceByGoogleSub: vi.fn(),
  findWorkspaceBySlug: vi.fn(),
}));

vi.mock('../_session.js', () => ({
  createSessionCookie: vi.fn(() => 'portal_session=sess-token'),
  readCookie: vi.fn(() => 'state123'),
}));

import { exchangeCodeForIdentity } from '../_oidc.js';
import { createWorkspaceForOwner, findWorkspaceByGoogleSub, findWorkspaceBySlug } from '../_db.js';

function makeRes() {
  const payload: { code?: number; redirectUrl?: string; headers?: Record<string, string | string[]>; body?: unknown } = {};
  return {
    payload,
    setHeader(name: string, value: string | string[]) {
      payload.headers = payload.headers ?? {};
      payload.headers[name] = value;
    },
    status(code: number) {
      payload.code = code;
      return {
        json(body: unknown) {
          payload.body = body;
        },
      };
    },
    redirect(code: number, url: string) {
      payload.code = code;
      payload.redirectUrl = url;
    },
    json(body: unknown) {
      payload.body = body;
    },
  };
}

describe('auth callback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('auto-provisions unknown user and redirects to app', async () => {
    vi.mocked(exchangeCodeForIdentity).mockResolvedValue({ sub: 'sub1', email: 'coach@example.com' } as never);
    vi.mocked(findWorkspaceByGoogleSub)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ workspaceId: 'w1', workspaceSlug: 'coach' } as never);
    vi.mocked(findWorkspaceBySlug).mockResolvedValue(null as never);
    vi.mocked(createWorkspaceForOwner).mockResolvedValue({ workspaceId: 'w1', workspaceSlug: 'coach' } as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { code: 'c1', state: 'state123:%2F' }, headers: { cookie: 'oidc_state=state123' } }, res as never);

    expect(createWorkspaceForOwner).toHaveBeenCalled();
    expect(res.payload.code).toBe(302);
    expect(res.payload.redirectUrl).toBe('/');
  });
});
