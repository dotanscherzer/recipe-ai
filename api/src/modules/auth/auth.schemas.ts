import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string(),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const updateMeSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  locale: z.string().optional(),
  avatarUrl: z.string().url('Invalid URL').optional(),
});
