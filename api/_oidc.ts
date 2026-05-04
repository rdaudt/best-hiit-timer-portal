import { decodeJwt } from 'jose';

type TokenResponse = {
  id_token: string;
};

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const getBaseUrl = () => requireEnv('APP_BASE_URL').replace(/\/$/, '');

export function buildGoogleAuthUrl(state: string, redirect = '/') {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const callbackUrl = `${getBaseUrl()}/api/auth/callback`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', `${state}:${encodeURIComponent(redirect)}`);
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
  const idToken = decodeJwt(json.id_token);
  const sub = String(idToken.sub ?? '');
  const email = String(idToken.email ?? '');

  if (!sub || !email) {
    throw new Error('Missing subject/email in Google ID token.');
  }

  return { sub, email };
}