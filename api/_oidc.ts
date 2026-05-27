import { createRemoteJWKSet, jwtVerify } from 'jose';

type TokenResponse = {
  id_token: string;
};

type OidcStatePayload = {
  redirect: string;
  invite?: string;
};

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const getBaseUrl = () => requireEnv('APP_BASE_URL').replace(/\/$/, '');

const encodeStatePayload = (payload: OidcStatePayload) => Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

export const decodeStatePayload = (encoded: string): OidcStatePayload | null => {
  try {
    const raw = Buffer.from(encoded, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as Partial<OidcStatePayload>;
    const redirect = typeof parsed.redirect === 'string' ? parsed.redirect : '/';
    const invite = typeof parsed.invite === 'string' ? parsed.invite : undefined;
    return { redirect, invite };
  } catch {
    return null;
  }
};

export function buildGoogleAuthUrl(state: string, redirect = '/', invite = '') {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const callbackUrl = `${getBaseUrl()}/api/auth/callback`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', `${state}:${encodeStatePayload({ redirect, invite: invite || undefined })}`);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export async function exchangeCodeForIdentity(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: requireEnv('GOOGLE_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
    redirect_uri: `${getBaseUrl()}/api/auth/callback`,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status})`);
  }

  const json = (await response.json()) as TokenResponse;
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const verified = await jwtVerify(json.id_token, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
  });

  const sub = String(verified.payload.sub ?? '');
  const email = String(verified.payload.email ?? '');
  const familyName = String(verified.payload.family_name ?? '').trim();
  const fullName = String(verified.payload.name ?? '').trim();

  if (!sub || !email) {
    throw new Error('Missing subject/email in Google ID token.');
  }

  return { sub, email, familyName, fullName };
}
