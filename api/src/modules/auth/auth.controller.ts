import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env';
import { prisma } from '../../../config/db';
import { AuthRequest } from '../../../middleware/auth';
import { AppError } from '../../../middleware/errorHandler';

function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
}

function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });
}

function parseExpiry(expiry: string): Date {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // default 30d

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit]!;
  return new Date(Date.now() + value * ms);
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
