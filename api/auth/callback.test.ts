import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './callback';

vi.mock('../_oidc.js', () => ({
  decodeStatePayload: vi.fn(() => ({ redirect: '/', invite: 'legacy-invite' })),
  exchangeCodeForIdentity: vi.fn(),
}));

vi.mock('../_db.js', () => ({
  createCoachTenantTablesIfNeeded: vi.fn(),
  createWorkspaceForOwner: vi.fn(),
  findWorkspaceByGoogleSub: vi.fn(),
  updateWorkspaceQrCodeUrl: vi.fn(),
  workspaceSlugExists: vi.fn(),
}));

vi.mock('../_session.js', () => ({
  createSessionCookie: vi.fn(() => 'portal_session=sess-token'),
  readCookie: vi.fn(() => 'state123'),
}));

vi.mock('../_qrCode.js', () => ({
  provisionWorkspaceQrCode: vi.fn(),
}));

import { decodeStatePayload, exchangeCodeForIdentity } from '../_oidc.js';
import { createWorkspaceForOwner, findWorkspaceByGoogleSub, updateWorkspaceQrCodeUrl, workspaceSlugExists } from '../_db.js';
import { provisionWorkspaceQrCode } from '../_qrCode.js';

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
    vi.mocked(decodeStatePayload).mockReturnValue({ redirect: '/', invite: 'legacy-invite' } as never);
  });

  it('auto-provisions a new coach without any invite lookup and redirects to app', async () => {
    vi.mocked(exchangeCodeForIdentity).mockResolvedValue({ sub: 'sub1', email: 'coach@example.com' } as never);
    vi.mocked(findWorkspaceByGoogleSub).mockResolvedValueOnce(null as never);
    vi.mocked(workspaceSlugExists).mockResolvedValue(false as never);
    vi.mocked(createWorkspaceForOwner).mockResolvedValue({ workspaceId: 'w1', workspaceSlug: 'coach', deletedAt: null } as never);
    vi.mocked(provisionWorkspaceQrCode).mockResolvedValue({ url: 'https://blob.vercel-storage.com/tenants/w1/branding/qr.png' } as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { code: 'c1', state: 'state123:payload' }, headers: { cookie: 'oidc_state=state123' } }, res as never);

    expect(findWorkspaceByGoogleSub).toHaveBeenCalledWith('sub1');
    expect(createWorkspaceForOwner).toHaveBeenCalledWith({
      ownerGoogleSub: 'sub1',
      ownerEmail: 'coach@example.com',
      slug: 'coach',
      initialCoachName: undefined,
    });
    expect(provisionWorkspaceQrCode).toHaveBeenCalledWith('w1', 'coach');
    expect(updateWorkspaceQrCodeUrl).toHaveBeenCalledWith('w1', 'https://blob.vercel-storage.com/tenants/w1/branding/qr.png');
    expect(res.payload.code).toBe(302);
    expect(res.payload.redirectUrl).toBe('/');
  });

  it('continues signup when qr provisioning fails', async () => {
    vi.mocked(exchangeCodeForIdentity).mockResolvedValue({ sub: 'sub1', email: 'coach@example.com' } as never);
    vi.mocked(findWorkspaceByGoogleSub).mockResolvedValueOnce(null as never);
    vi.mocked(workspaceSlugExists).mockResolvedValue(false as never);
    vi.mocked(createWorkspaceForOwner).mockResolvedValue({ workspaceId: 'w1', workspaceSlug: 'coach', deletedAt: null } as never);
    vi.mocked(provisionWorkspaceQrCode).mockRejectedValue(new Error('blob failed') as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { code: 'c1', state: 'state123:payload' }, headers: { cookie: 'oidc_state=state123' } }, res as never);

    expect(res.payload.code).toBe(302);
    expect(updateWorkspaceQrCodeUrl).not.toHaveBeenCalled();
  });

  it('skips provisioning and invite logic for an existing coach', async () => {
    vi.mocked(exchangeCodeForIdentity).mockResolvedValue({ sub: 'sub1', email: 'coach@example.com' } as never);
    vi.mocked(findWorkspaceByGoogleSub).mockResolvedValue({ workspaceId: 'w1', workspaceSlug: 'coach' } as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { code: 'c1', state: 'state123:payload' }, headers: { cookie: 'oidc_state=state123' } }, res as never);

    expect(createWorkspaceForOwner).not.toHaveBeenCalled();
    expect(provisionWorkspaceQrCode).not.toHaveBeenCalled();
    expect(res.payload.code).toBe(302);
    expect(res.payload.redirectUrl).toBe('/');
  });

  it('tolerates legacy invite state without requiring it', async () => {
    vi.mocked(exchangeCodeForIdentity).mockResolvedValue({ sub: 'sub1', email: 'coach@example.com' } as never);
    vi.mocked(findWorkspaceByGoogleSub).mockResolvedValueOnce(null as never);
    vi.mocked(workspaceSlugExists).mockResolvedValue(false as never);
    vi.mocked(createWorkspaceForOwner).mockResolvedValue({ workspaceId: 'w1', workspaceSlug: 'coach', deletedAt: null } as never);
    vi.mocked(provisionWorkspaceQrCode).mockResolvedValue({ url: 'https://blob.vercel-storage.com/tenants/w1/branding/qr.png' } as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { code: 'c1', state: 'state123:payload' }, headers: { cookie: 'oidc_state=state123' } }, res as never);

    expect(res.payload.code).toBe(302);
    expect(res.payload.redirectUrl).toBe('/');
  });
});
