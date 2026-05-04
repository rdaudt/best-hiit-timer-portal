import { requirePortalSession } from '../_portalAuth.js';

type NodeReq = { method?: string; headers?: Record<string, string | string[] | undefined> };
type NodeRes = { status: (code: number) => { json: (body: unknown) => void } };

export default async function handler(req: NodeReq, res: NodeRes) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const auth = await requirePortalSession(req);
  if (!auth.ok) {
    res.status(auth.status).json(auth.body);
    return;
  }

  res.status(200).json({
    workspaceId: auth.session.workspaceId,
    workspaceSlug: auth.session.workspaceSlug,
    actorGoogleSub: auth.session.sub,
    actorEmail: auth.session.email,
  });
}