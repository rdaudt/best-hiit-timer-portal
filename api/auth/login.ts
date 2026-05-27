import { buildGoogleAuthUrl } from '../_oidc.js';
import { createStateCookie } from '../_session.js';

type NodeReq = { method?: string; query?: Record<string, string | string[]> };
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

  const redirect = typeof req.query?.redirect === 'string' ? req.query.redirect : '/';
  const invite = typeof req.query?.invite === 'string' ? req.query.invite : '';
  const stateCookie = createStateCookie();
  res.setHeader('Set-Cookie', stateCookie.header);
  res.redirect(302, buildGoogleAuthUrl(stateCookie.value, redirect, invite));
}
