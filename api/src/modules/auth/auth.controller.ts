import { randomBytes, createHash } from 'crypto';
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { sendPasswordResetEmail } from '../../lib/mail';
import { generateAccessToken, generateRefreshToken, parseExpiry } from './auth.tokens';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Same response whether or not the email exists (avoid account enumeration). */
export async function forgotPassword(req: AuthRequest, res: Response) {
  const { email } = req.body;
  const okMessage = {
    message:
      'If an account exists for this email, we sent password reset instructions.',
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    res.json(okMessage);
    return;
  }

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(rawToken);

  const resetRow = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const base = env.APP_URL.replace(/\/$/, '');
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (err) {
    await prisma.passwordResetToken.delete({ where: { id: resetRow.id } }).catch(() => {});
    console.error('[auth] forgot-password: email send failed', err);
  }

  res.json(okMessage);
}

export async function resetPassword(req: AuthRequest, res: Response) {
  const { token, newPassword } = req.body;
  const tokenHash = hashResetToken(token);

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!row || row.expiresAt < new Date()) {
    throw new AppError(400, 'Invalid or expired reset link');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({ where: { id: row.id } }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);

  res.json({ message: 'Password updated successfully' });
}

export async function register(req: AuthRequest, res: Response) {
  const { fullName, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { fullName, email, passwordHash },
    select: { id: true, fullName: true, email: true, role: true, locale: true, avatarUrl: true, createdAt: true },
  });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      expiresAt: parseExpiry(env.JWT_REFRESH_EXPIRY),
    },
  });

  res.status(201).json({ accessToken, refreshToken, user });
}

export async function login(req: AuthRequest, res: Response) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new AppError(401, 'Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password');
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      expiresAt: parseExpiry(env.JWT_REFRESH_EXPIRY),
    },
  });

  const { passwordHash: _, ...safeUser } = user;
  res.json({ accessToken, refreshToken, user: safeUser });
}

export async function refreshToken(req: AuthRequest, res: Response) {
  const { refreshToken: token } = req.body;

  let payload: { userId: string };
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const session = await prisma.session.findUnique({
    where: { refreshToken: token },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  const newAccessToken = generateAccessToken(payload.userId);
  const newRefreshToken = generateRefreshToken(payload.userId);

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshToken: newRefreshToken,
      expiresAt: parseExpiry(env.JWT_REFRESH_EXPIRY),
    },
  });

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
}

export async function logout(req: AuthRequest, res: Response) {
  const { refreshToken: token } = req.body;

  if (token) {
    await prisma.session.deleteMany({ where: { refreshToken: token } });
  }

  res.json({ message: 'Logged out successfully' });
}

export async function getMe(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      locale: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  res.json({ user });
}

export async function updateMe(req: AuthRequest, res: Response) {
  const { fullName, locale, avatarUrl } = req.body;

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...(fullName !== undefined && { fullName }),
      ...(locale !== undefined && { locale }),
      ...(avatarUrl !== undefined && { avatarUrl }),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      locale: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ user });
}
