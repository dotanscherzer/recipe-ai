import { randomBytes } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { generateAccessToken, generateRefreshToken, parseExpiry } from './auth.tokens';

const STATE_PREFIX = 'oauth:state:';
const EXCHANGE_PREFIX = 'oauth:xc:';
const STATE_TTL_SEC = 600;
const EXCHANGE_TTL_SEC = 120;

function apiBase(): string {
  return env.API_URL.replace(/\/$/, '');
}

function appBase(): string {
  return env.APP_URL.replace(/\/$/, '');
}

function redirectWithError(res: Response, code: string, detail?: string) {
  const u = new URL(`${appBase()}/oauth-callback`);
  u.searchParams.set('error', code);
  if (detail) u.searchParams.set('detail', detail);
  res.redirect(u.toString());
}

function redirectWithExchangeCode(res: Response, exchangeCode: string) {
  const u = new URL(`${appBase()}/oauth-callback`);
  u.searchParams.set('code', exchangeCode);
  res.redirect(u.toString());
}

async function storeExchangeTokens(accessToken: string, refreshToken: string): Promise<string> {
  const code = randomBytes(24).toString('base64url');
  const key = `${EXCHANGE_PREFIX}${code}`;
  await redis.set(
    key,
    JSON.stringify({ accessToken, refreshToken }),
    'EX',
    EXCHANGE_TTL_SEC
  );
  return code;
}

async function issueSessionAndRedirect(res: Response, userId: string) {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);

  await prisma.session.create({
    data: {
      userId,
      refreshToken,
      expiresAt: parseExpiry(env.JWT_REFRESH_EXPIRY),
    },
  });

  const exchangeCode = await storeExchangeTokens(accessToken, refreshToken);
  redirectWithExchangeCode(res, exchangeCode);
}

export async function authProviders(_req: Request, res: Response): Promise<void> {
  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const appleConfigured = Boolean(
    env.APPLE_CLIENT_ID &&
      env.APPLE_TEAM_ID &&
      env.APPLE_KEY_ID &&
      env.APPLE_PRIVATE_KEY_PATH &&
      existsSync(env.APPLE_PRIVATE_KEY_PATH)
  );
  res.json({ google: googleConfigured, apple: appleConfigured });
}

export async function googleStart(_req: Request, res: Response): Promise<void> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    redirectWithError(res, 'oauth_not_configured', 'google');
    return;
  }

  const state = randomBytes(24).toString('base64url');
  await redis.set(`${STATE_PREFIX}${state}`, 'google', 'EX', STATE_TTL_SEC);

  const redirectUri = `${apiBase()}/auth/google/callback`;
  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
    state,
  });
  res.redirect(url);
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
  const err = typeof req.query.error === 'string' ? req.query.error : undefined;
  if (err) {
    redirectWithError(res, err === 'access_denied' ? 'access_denied' : 'oauth_error', 'google');
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  if (!code || !state) {
    redirectWithError(res, 'invalid_callback', 'google');
    return;
  }

  const stored = await redis.get(`${STATE_PREFIX}${state}`);
  await redis.del(`${STATE_PREFIX}${state}`);
  if (stored !== 'google') {
    redirectWithError(res, 'invalid_state', 'google');
    return;
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    redirectWithError(res, 'oauth_not_configured', 'google');
    return;
  }

  const redirectUri = `${apiBase()}/auth/google/callback`;
  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);

  let tokens;
  try {
    const result = await client.getToken({ code, redirect_uri: redirectUri });
    tokens = result.tokens;
  } catch {
    redirectWithError(res, 'token_exchange_failed', 'google');
    return;
  }

  client.setCredentials(tokens);

  let email: string | undefined;
  let googleId: string | undefined;
  let fullName: string | undefined;
  let avatarUrl: string | undefined;

  try {
    const r = await client.request<{ id?: string; email?: string; name?: string; picture?: string }>({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    });
    const data = r.data;
    googleId = data.id;
    email = data.email ?? undefined;
    fullName = data.name?.trim() || email?.split('@')[0] || 'User';
    avatarUrl = data.picture ?? undefined;
  } catch {
    redirectWithError(res, 'profile_failed', 'google');
    return;
  }

  if (!googleId || !email) {
    redirectWithError(res, 'missing_profile', 'google');
    return;
  }

  let user = await prisma.user.findUnique({ where: { googleId } });
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId,
          ...(avatarUrl && !byEmail.avatarUrl ? { avatarUrl } : {}),
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          fullName: fullName!,
          googleId,
          avatarUrl: avatarUrl ?? null,
          passwordHash: null,
        },
      });
    }
  }

  await issueSessionAndRedirect(res, user.id);
}

function getAppleClientSecret(): string {
  const privateKey = readFileSync(env.APPLE_PRIVATE_KEY_PATH!, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: env.APPLE_TEAM_ID,
      iat: now,
      exp: now + 3600,
      aud: 'https://appleid.apple.com',
      sub: env.APPLE_CLIENT_ID,
    },
    privateKey,
    { algorithm: 'ES256', keyid: env.APPLE_KEY_ID }
  );
}

export async function appleStart(_req: Request, res: Response): Promise<void> {
  if (
    !env.APPLE_CLIENT_ID ||
    !env.APPLE_TEAM_ID ||
    !env.APPLE_KEY_ID ||
    !env.APPLE_PRIVATE_KEY_PATH ||
    !existsSync(env.APPLE_PRIVATE_KEY_PATH)
  ) {
    redirectWithError(res, 'oauth_not_configured', 'apple');
    return;
  }

  const state = randomBytes(24).toString('base64url');
  await redis.set(`${STATE_PREFIX}${state}`, 'apple', 'EX', STATE_TTL_SEC);

  const redirectUri = `${apiBase()}/auth/apple/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.APPLE_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'name email',
    state,
    response_mode: 'query',
  });

  res.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
}

interface AppleIdTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
}

export async function appleCallback(req: Request, res: Response): Promise<void> {
  const err = typeof req.query.error === 'string' ? req.query.error : undefined;
  if (err) {
    redirectWithError(res, err === 'user_cancelled_authorize' || err === 'access_denied' ? 'access_denied' : 'oauth_error', 'apple');
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  if (!code || !state) {
    redirectWithError(res, 'invalid_callback', 'apple');
    return;
  }

  const stored = await redis.get(`${STATE_PREFIX}${state}`);
  await redis.del(`${STATE_PREFIX}${state}`);
  if (stored !== 'apple') {
    redirectWithError(res, 'invalid_state', 'apple');
    return;
  }

  if (
    !env.APPLE_CLIENT_ID ||
    !env.APPLE_TEAM_ID ||
    !env.APPLE_KEY_ID ||
    !env.APPLE_PRIVATE_KEY_PATH ||
    !existsSync(env.APPLE_PRIVATE_KEY_PATH)
  ) {
    redirectWithError(res, 'oauth_not_configured', 'apple');
    return;
  }

  const redirectUri = `${apiBase()}/auth/apple/callback`;
  const clientSecret = getAppleClientSecret();

  const body = new URLSearchParams({
    client_id: env.APPLE_CLIENT_ID,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  let idToken: string | undefined;
  try {
    const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!tokenRes.ok) {
      redirectWithError(res, 'token_exchange_failed', 'apple');
      return;
    }
    const tokenJson = (await tokenRes.json()) as { id_token?: string };
    idToken = tokenJson.id_token;
  } catch {
    redirectWithError(res, 'token_exchange_failed', 'apple');
    return;
  }

  if (!idToken) {
    redirectWithError(res, 'missing_id_token', 'apple');
    return;
  }

  const decoded = jwt.decode(idToken, { complete: true });
  const payload = (decoded?.payload ?? {}) as AppleIdTokenPayload;
  const appleId = payload.sub;
  let email = typeof payload.email === 'string' ? payload.email : undefined;

  let firstName = '';
  let lastName = '';
  const userParam = typeof req.query.user === 'string' ? req.query.user : undefined;
  if (userParam) {
    try {
      const u = JSON.parse(userParam) as { name?: { firstName?: string; lastName?: string } };
      firstName = u.name?.firstName ?? '';
      lastName = u.name?.lastName ?? '';
    } catch {
      /* ignore */
    }
  }

  const fullNameFromApple = [firstName, lastName].filter(Boolean).join(' ').trim();

  if (!appleId) {
    redirectWithError(res, 'missing_profile', 'apple');
    return;
  }

  if (!email) {
    email = `apple_${appleId.replace(/[^a-z0-9]/gi, '')}@internal.oauth`;
  }

  let user = await prisma.user.findUnique({ where: { appleId } });
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { appleId },
      });
    } else {
      const fullName = fullNameFromApple || email.split('@')[0] || 'User';
      user = await prisma.user.create({
        data: {
          email,
          fullName,
          appleId,
          passwordHash: null,
        },
      });
    }
  }

  await issueSessionAndRedirect(res, user.id);
}

export async function oauthExchange(req: Request, res: Response): Promise<void> {
  const { code } = req.body as { code?: string };
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Invalid exchange code' });
    return;
  }

  const key = `${EXCHANGE_PREFIX}${code}`;
  const raw = await redis.get(key);
  await redis.del(key);

  if (!raw) {
    res.status(400).json({ error: 'Invalid or expired exchange code' });
    return;
  }

  try {
    const { accessToken, refreshToken } = JSON.parse(raw) as {
      accessToken: string;
      refreshToken: string;
    };
    if (!accessToken || !refreshToken) {
      res.status(400).json({ error: 'Invalid exchange payload' });
      return;
    }
    res.json({ accessToken, refreshToken });
  } catch {
    res.status(400).json({ error: 'Invalid exchange payload' });
  }
}
