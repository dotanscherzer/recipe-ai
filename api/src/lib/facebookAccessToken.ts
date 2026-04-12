import { env } from '../config/env';

/** `.env` lines are sometimes saved as `"secret"` — Meta rejects those. */
function stripQuotes(s: string | undefined): string | undefined {
  if (!s) return s;
  let t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

/**
 * Meta Graph expects an app access token, usually `APP_ID|APP_SECRET`.
 * Some hosts break a single `.env` line that contains `|`; use FACEBOOK_APP_ID + FACEBOOK_APP_SECRET instead.
 * When both ID and secret are set, they take precedence over FACEBOOK_APP_ACCESS_TOKEN so a broken combined line is ignored.
 */
export function resolveFacebookGraphAccessToken(): string | undefined {
  const id = stripQuotes(env.FACEBOOK_APP_ID);
  const secret = stripQuotes(env.FACEBOOK_APP_SECRET);
  if (id && secret) return `${id}|${secret}`;

  const combined = stripQuotes(env.FACEBOOK_APP_ACCESS_TOKEN);
  if (combined) return combined;

  return undefined;
}

/**
 * Prefer Meta's OAuth `client_credentials` response when App ID + Secret are set.
 * It matches manual `APP_ID|APP_SECRET` when credentials are correct, but avoids subtle `.env` corruption.
 */
export async function getFacebookGraphAccessTokenForApi(): Promise<string | undefined> {
  const id = stripQuotes(env.FACEBOOK_APP_ID);
  const secret = stripQuotes(env.FACEBOOK_APP_SECRET);
  if (id && secret) {
    try {
      const u = new URL('https://graph.facebook.com/oauth/access_token');
      u.searchParams.set('client_id', id);
      u.searchParams.set('client_secret', secret);
      u.searchParams.set('grant_type', 'client_credentials');
      const res = await fetch(u.toString(), { signal: AbortSignal.timeout(15000) });
      const raw = await res.text();
      if (res.ok) {
        const data = JSON.parse(raw) as { access_token?: string };
        if (typeof data.access_token === 'string' && data.access_token.length > 0) {
          return data.access_token;
        }
      }
    } catch {
      // use manual token below
    }
  }
  return resolveFacebookGraphAccessToken();
}
