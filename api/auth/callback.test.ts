import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './callback';

vi.mock('../_oidc.js', () => ({
  decodeStatePayload: vi.fn(() => ({ redirect: '/', invite: 'invite-1' })),
  exchangeCodeForIdentity: vi.fn(),
}));

vi.mock('../_db.js', () => ({
  consumeInvite: vi.fn(),
  createCoachTenantTablesIfNeeded: vi.fn(),
  createWorkspaceForOwner: vi.fn(),
  findActiveInviteByCode: vi.fn(),
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
import { consumeInvite, createWorkspaceForOwner, findActiveInviteByCode, findWorkspaceByGoogleSub, updateWorkspaceQrCodeUrl, workspaceSlugExists } from '../_db.js';
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
    vi.mocked(decodeStatePayload).mockReturnValue({ redirect: '/', invite: 'invite-1' } as never);
  });

  it('auto-provisions unknown user with valid invite and redirects to app', async () => {
    vi.mocked(exchangeCodeForIdentity).mockResolvedValue({ sub: 'sub1', email: 'coach@example.com' } as never);
    vi.mocked(findWorkspaceByGoogleSub)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ workspaceId: 'w1', workspaceSlug: 'coach' } as never);
    vi.mocked(workspaceSlugExists).mockResolvedValue(false as never);
    vi.mocked(findActiveInviteByCode).mockResolvedValue({ status: 'ok', invite: { id: 'invite-1' } } as never);
    vi.mocked(createWorkspaceForOwner).mockResolvedValue({ workspaceId: 'w1', workspaceSlug: 'coach', deletedAt: null } as never);
    vi.mocked(provisionWorkspaceQrCode).mockResolvedValue({ url: 'https://blob.vercel-storage.com/tenants/w1/branding/qr.png' } as never);
    vi.mocked(consumeInvite).mockResolvedValue(true as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { code: 'c1', state: 'state123:payload' }, headers: { cookie: 'oidc_state=state123' } }, res as never);

    expect(createWorkspaceForOwner).toHaveBeenCalled();
    expect(provisionWorkspaceQrCode).toHaveBeenCalledWith('w1', 'coach');
    expect(updateWorkspaceQrCodeUrl).toHaveBeenCalledWith('w1', 'https://blob.vercel-storage.com/tenants/w1/branding/qr.png');
    expect(consumeInvite).toHaveBeenCalledWith('invite-1', { sub: 'sub1', email: 'coach@example.com' }, 'w1');
    expect(res.payload.code).toBe(302);
    expect(res.payload.redirectUrl).toBe('/');
  });

  it('continues signup when qr provisioning fails', async () => {
    vi.mocked(exchangeCodeForIdentity).mockResolvedValue({ sub: 'sub1', email: 'coach@example.com' } as never);
    vi.mocked(findWorkspaceByGoogleSub)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ workspaceId: 'w1', workspaceSlug: 'coach' } as never);
    vi.mocked(workspaceSlugExists).mockResolvedValue(false as never);
    vi.mocked(findActiveInviteByCode).mockResolvedValue({ status: 'ok', invite: { id: 'invite-1' } } as never);
    vi.mocked(createWorkspaceForOwner).mockResolvedValue({ workspaceId: 'w1', workspaceSlug: 'coach', deletedAt: null } as never);
    vi.mocked(provisionWorkspaceQrCode).mockRejectedValue(new Error('blob failed') as never);
    vi.mocked(consumeInvite).mockResolvedValue(true as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { code: 'c1', state: 'state123:payload' }, headers: { cookie: 'oidc_state=state123' } }, res as never);

    expect(res.payload.code).toBe(302);
    expect(updateWorkspaceQrCodeUrl).not.toHaveBeenCalled();
    expect(consumeInvite).toHaveBeenCalledTimes(1);
  });

  it('skips invite checks for existing coach', async () => {
    vi.mocked(exchangeCodeForIdentity).mockResolvedValue({ sub: 'sub1', email: 'coach@example.com' } as never);
    vi.mocked(findWorkspaceByGoogleSub).mockResolvedValue({ workspaceId: 'w1', workspaceSlug: 'coach' } as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { code: 'c1', state: 'state123:payload' }, headers: { cookie: 'oidc_state=state123' } }, res as never);

    expect(findActiveInviteByCode).not.toHaveBeenCalled();
    expect(res.payload.code).toBe(302);
    expect(res.payload.redirectUrl).toBe('/');
  });

  it('redirects to signin with missing invite for new coach', async () => {
    vi.mocked(decodeStatePayload).mockReturnValue({ redirect: '/', invite: '' } as never);
    vi.mocked(exchangeCodeForIdentity).mockResolvedValue({ sub: 'sub1', email: 'coach@example.com' } as never);
    vi.mocked(findWorkspaceByGoogleSub).mockResolvedValue(null as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { code: 'c1', state: 'state123:payload' }, headers: { cookie: 'oidc_state=state123' } }, res as never);

    expect(res.payload.code).toBe(302);
    expect(res.payload.redirectUrl).toBe('/signin?invite_error=missing');
  });

  it('redirects with specific invite reason for invalid invite', async () => {
    vi.mocked(exchangeCodeForIdentity).mockResolvedValue({ sub: 'sub1', email: 'coach@example.com' } as never);
    vi.mocked(findWorkspaceByGoogleSub).mockResolvedValue(null as never);
    vi.mocked(findActiveInviteByCode).mockResolvedValue({ status: 'invalid', invite: null } as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { code: 'c1', state: 'state123:payload' }, headers: { cookie: 'oidc_state=state123' } }, res as never);

    expect(res.payload.code).toBe(302);
    expect(res.payload.redirectUrl).toBe('/signin?invite_error=invalid');
  });

  it('does not sign in when invite consumption fails after provisioning', async () => {
    vi.mocked(exchangeCodeForIdentity).mockResolvedValue({ sub: 'sub1', email: 'coach@example.com' } as never);
    vi.mocked(findWorkspaceByGoogleSub)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ workspaceId: 'w1', workspaceSlug: 'coach' } as never);
    vi.mocked(workspaceSlugExists).mockResolvedValue(false as never);
    vi.mocked(findActiveInviteByCode).mockResolvedValue({ status: 'ok', invite: { id: 'invite-1' } } as never);
    vi.mocked(createWorkspaceForOwner).mockResolvedValue({ workspaceId: 'w1', workspaceSlug: 'coach', deletedAt: null } as never);
    vi.mocked(consumeInvite).mockResolvedValue(false as never);

    const res = makeRes();
    await handler({ method: 'GET', query: { code: 'c1', state: 'state123:payload' }, headers: { cookie: 'oidc_state=state123' } }, res as never);

    expect(res.payload.code).toBe(302);
    expect(res.payload.redirectUrl).toBe('/signin?invite_error=used');
  });
});
