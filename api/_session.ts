import { createHmac, randomBytes } from 'node:crypto';

const SESSION_COOKIE = 'portal_session';

export type SessionUser = {
  sub: string;
  email: string;
  workspaceSlug: string;
};

type SessionPayload = SessionUser & {
  exp: number;
};

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const getSecret = () => requireEnv('AUTH_SESSION_SECRET');

const toBase64Url = (value: string) => Buffer.from(value, 'utf8').toString('base64url');
const fromBase64Url = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

function sign(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

export function createStateCookie() {
  const value = randomBytes(24).toString('base64url');
  return {
    value,
    header: `oidc_state=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  };
}

export function readCookie(req: { headers?: Record<string, string | string[] | undefined> }, name: string) {
  const raw = req.headers?.cookie;
  const header = Array.isArray(raw) ? raw.join(';') : raw ?? '';
  const parts = header.split(';').map((item) => item.trim());
  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    if (key === name) {
      return rest.join('=');
    }
  }
  return '';
}

export function createSessionCookie(user: SessionUser) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = sign(encoded);
  const token = `${encoded}.${signature}`;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function parseSession(req: { headers?: Record<string, string | string[] | undefined> }): SessionUser | null {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) {
    return null;
  }

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature || sign(encoded) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encoded)) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      workspaceSlug: payload.workspaceSlug,
    };
  } catch {
    return null;
  }
}
