import { parseSession } from '../_session.js';

type NodeReq = { method?: string; headers?: Record<string, string | string[] | undefined> };
type NodeRes = { status: (code: number) => { json: (body: unknown) => void } };

export default async function handler(req: NodeReq, res: NodeRes) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const session = parseSession(req);
  res.status(200).json({ user: session });
}