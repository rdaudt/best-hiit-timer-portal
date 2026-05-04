import { clearSessionCookie } from '../_session.js';

type NodeReq = { method?: string };
type NodeRes = {
  setHeader: (name: string, value: string | string[]) => void;
  status: (code: number) => { json: (body: unknown) => void };
};

export default async function handler(req: NodeReq, res: NodeRes) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  res.setHeader('Set-Cookie', clearSessionCookie());
  res.status(200).json({ ok: true });
}