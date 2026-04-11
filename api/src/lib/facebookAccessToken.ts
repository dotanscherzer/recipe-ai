import { env } from '../config/env';

/**
 * Meta Graph expects an app access token, usually `APP_ID|APP_SECRET`.
 * Some hosts break a single `.env` line that contains `|`; use FACEBOOK_APP_ID + FACEBOOK_APP_SECRET instead.
 * When both ID and secret are set, they take precedence over FACEBOOK_APP_ACCESS_TOKEN so a broken combined line is ignored.
 */
export function resolveFacebookGraphAccessToken(): string | undefined {
  const id = env.FACEBOOK_APP_ID?.trim();
  const secret = env.FACEBOOK_APP_SECRET?.trim();
  if (id && secret) return `${id}|${secret}`;

  const combined = env.FACEBOOK_APP_ACCESS_TOKEN?.trim();
  if (combined) return combined;

  return undefined;
}
