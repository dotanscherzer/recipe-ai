import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  S3_ENDPOINT: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_BUCKET: z.string().default('recipe-ai'),
  S3_REGION: z.string().default('us-east-1'),

  /** OpenAI — default path (`automatic` → gpt-4o-mini) */
  OPENAI_API_KEY: z.string().optional(),
  /** Google AI Studio / Gemini — required when using internet context or Gemini models */
  GOOGLE_AI_API_KEY: z.string().optional(),
  /** Internal aliases → real Gemini API model ids (override when Google renames models) */
  GEMINI_MODEL_FLASH: z.string().default('gemini-2.0-flash'),
  GEMINI_MODEL_PRO: z.string().default('gemini-1.5-pro'),
  /** When `add_context_from_internet` and text length >= threshold, prefer Pro (unless LLM_INTERNET_PREFER locks flash) */
  LLM_INTERNET_USE_PRO_THRESHOLD: z.coerce.number().int().positive().default(12000),
  LLM_INTERNET_PREFER: z.enum(['flash', 'pro']).default('flash'),

  UNSPLASH_ACCESS_KEY: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY_PATH: z.string().optional(),

  APP_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:3001'),

  /** Optional SMTP for password-reset emails (Hostinger etc. often provide these). */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  /** Optional: transactional email over HTTPS (works when VPS blocks SMTP). https://resend.com */
  RESEND_API_KEY: z.string().optional(),
  /** Verified sender in Resend, e.g. Recipe AI <onboarding@resend.dev> or your domain */
  RESEND_FROM: z.string().optional(),
});

export const env = envSchema.parse(process.env);
