import { decodeStatePayload, exchangeCodeForIdentity } from '../_oidc.js';
import {
  consumeInvite,
  createCoachTenantTablesIfNeeded,
  createWorkspaceForOwner,
  findActiveInviteByCode,
  findWorkspaceByGoogleSub,
  updateWorkspaceQrCodeUrl,
  workspaceSlugExists,
} from '../_db.js';
import { provisionWorkspaceQrCode } from '../_qrCode.js';
import { createSessionCookie, readCookie } from '../_session.js';

type NodeReq = { method?: string; query?: Record<string, string | string[]>; headers?: Record<string, string | string[] | undefined> };
type NodeRes = {
  setHeader: (name: string, value: string | string[]) => void;
  status: (code: number) => NodeRes;
  redirect: (code: number, url: string) => void;
  json: (body: unknown) => void;
};

const toSlugBase = (email: string) => {
  const local = email.split('@')[0]?.toLowerCase() ?? 'coach';
  const sanitized = local
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const base = sanitized || 'coach';
  return base.length > 34 ? base.slice(0, 34).replace(/-$/g, '') : base;
};

async function generateAvailableSlug(email: string) {
  const base = toSlugBase(email);
  for (let i = 0; i < 100; i += 1) {
    const suffix = i === 0 ? '' : `-${i + 1}`;
    const slug = `${base}${suffix}`.slice(0, 40).replace(/-$/g, '') || 'coach';
    const exists = await workspaceSlugExists(slug);
    if (!exists) {
      return slug;
    }
  }
  throw new Error('Unable to generate available slug.');
}

function buildInitialCoachName(identity: { familyName?: string; fullName?: string; email: string }) {
  const family = identity.familyName?.trim();
  if (family) {
    return `Coach ${family}`;
  }

  const full = identity.fullName?.trim() ?? '';
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `Coach ${parts[parts.length - 1]}`;
  }

  const local = identity.email.split('@')[0] ?? '';
  const localParts = local.split(/[._-]+/).filter(Boolean);
  if (localParts.length > 1) {
    const last = localParts[localParts.length - 1];
    return `Coach ${last.charAt(0).toUpperCase()}${last.slice(1).toLowerCase()}`;
  }

  return undefined;
}

const clearStateCookie = 'oidc_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

const redirectInviteFailure = (res: NodeRes, reason: 'missing' | 'invalid' | 'expired' | 'used') => {
  res.setHeader('Set-Cookie', clearStateCookie);
  res.redirect(302, `/signin?invite_error=${reason}`);
};

export default async function handler(req: NodeReq, res: NodeRes) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const code = typeof req.query?.code === 'string' ? req.query.code : '';
  const state = typeof req.query?.state === 'string' ? req.query.state : '';
  const stored = readCookie(req, 'oidc_state');

  if (!code || !state || !stored || !state.startsWith(`${stored}:`)) {
    res.status(400).json({ error: 'Invalid auth callback state.' });
    return;
  }

  try {
    const payload = decodeStatePayload(state.slice(stored.length + 1));
    if (!payload) {
      res.status(400).json({ error: 'Invalid auth callback state.' });
      return;
    }

    const identity = await exchangeCodeForIdentity(code);
    await createCoachTenantTablesIfNeeded();
    let workspace = await findWorkspaceByGoogleSub(identity.sub);

    if (!workspace) {
      const inviteCode = payload.invite?.trim() ?? '';
      if (!inviteCode) {
        redirectInviteFailure(res, 'missing');
        return;
      }

      const inviteLookup = await findActiveInviteByCode(inviteCode);
      if (inviteLookup.status !== 'ok' || !inviteLookup.invite) {
        redirectInviteFailure(res, inviteLookup.status);
        return;
      }

      try {
        const slug = await generateAvailableSlug(identity.email);
        workspace = await createWorkspaceForOwner({
          ownerGoogleSub: identity.sub,
          ownerEmail: identity.email,
          slug,
          initialCoachName: buildInitialCoachName(identity),
        });

        try {
          const qr = await provisionWorkspaceQrCode(workspace.workspaceId, workspace.workspaceSlug);
          await updateWorkspaceQrCodeUrl(workspace.workspaceId, qr.url);
        } catch (qrError) {
          console.error('workspace qr provisioning failed', {
            workspaceId: workspace.workspaceId,
            slug: workspace.workspaceSlug,
            error: qrError instanceof Error ? qrError.message : String(qrError),
          });
        }

      } catch (error) {
        const latest = await findWorkspaceByGoogleSub(identity.sub);
        if (!latest) {
          throw error;
        }
        workspace = latest;
      }

      const consumed = await consumeInvite(inviteLookup.invite.id, identity, workspace.workspaceId);
      if (!consumed) {
        redirectInviteFailure(res, 'used');
        return;
      }
    }

    if (!workspace) {
      throw new Error('Workspace provisioning failed.');
    }

    const redirectTo = payload.redirect || '/';
    res.setHeader('Set-Cookie', [
      createSessionCookie({ sub: identity.sub, email: identity.email, workspaceSlug: workspace.workspaceSlug }),
      clearStateCookie,
    ]);
    res.redirect(302, redirectTo.startsWith('/') ? redirectTo : '/');
  } catch (error) {
    console.error('auth callback failed', error);
    const message = error instanceof Error ? error.message : 'Unknown sign-in failure.';
    res.status(500).json({ error: `Failed to sign in: ${message}` });
  }
}
