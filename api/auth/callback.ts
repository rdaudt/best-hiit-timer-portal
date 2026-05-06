import { exchangeCodeForIdentity } from '../_oidc.js';
import { createCoachTenantTablesIfNeeded, createWorkspaceForOwner, findWorkspaceByGoogleSub, findWorkspaceBySlug } from '../_db.js';
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
    const existing = await findWorkspaceBySlug(slug);
    if (!existing) {
      return slug;
    }
  }
  throw new Error('Unable to generate available slug.');
}

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
    const identity = await exchangeCodeForIdentity(code);
    await createCoachTenantTablesIfNeeded();
    let workspace = await findWorkspaceByGoogleSub(identity.sub);
    if (!workspace) {
      try {
        const slug = await generateAvailableSlug(identity.email);
        workspace = await createWorkspaceForOwner({
          ownerGoogleSub: identity.sub,
          ownerEmail: identity.email,
          slug,
        });
      } catch (error) {
        const latest = await findWorkspaceByGoogleSub(identity.sub);
        if (!latest) {
          throw error;
        }
        workspace = latest;
      }
    }

    const redirectTo = decodeURIComponent(state.slice(stored.length + 1) || '/');
    res.setHeader('Set-Cookie', [
      createSessionCookie({ sub: identity.sub, email: identity.email, workspaceSlug: workspace.workspaceSlug }),
      'oidc_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    ]);
    res.redirect(302, redirectTo.startsWith('/') ? redirectTo : '/');
  } catch (error) {
    console.error('auth callback failed', error);
    const message = error instanceof Error ? error.message : 'Unknown sign-in failure.';
    res.status(500).json({ error: `Failed to sign in: ${message}` });
  }
}
