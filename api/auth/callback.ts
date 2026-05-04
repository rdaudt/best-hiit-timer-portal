import { exchangeCodeForIdentity } from '../_oidc.js';
import { findWorkspaceByGoogleSub } from '../_db.js';
import { createSessionCookie, readCookie } from '../_session.js';

type NodeReq = { method?: string; query?: Record<string, string | string[]>; headers?: Record<string, string | string[] | undefined> };
type NodeRes = {
  setHeader: (name: string, value: string | string[]) => void;
  status: (code: number) => NodeRes;
  redirect: (code: number, url: string) => void;
  json: (body: unknown) => void;
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
    const identity = await exchangeCodeForIdentity(code);
    const workspace = await findWorkspaceByGoogleSub(identity.sub);
    if (!workspace) {
      res.status(403).json({ error: 'No workspace found for this account.' });
      return;
    }

    const redirectTo = decodeURIComponent(state.slice(stored.length + 1) || '/');
    res.setHeader('Set-Cookie', [
      createSessionCookie({ sub: identity.sub, email: identity.email, workspaceSlug: workspace.workspaceSlug }),
      'oidc_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    ]);
    res.redirect(302, redirectTo.startsWith('/') ? redirectTo : '/');
  } catch (error) {
    console.error('auth callback failed', error);
    res.status(500).json({ error: 'Failed to sign in.' });
  }
}