import { z } from 'zod';
import { normalizeImportUrl } from '../../lib/socialUrlEnrichment';

/** JSON clients often send `null`; plain `.optional()` only allows `undefined`. */
const optionalLocale = z.preprocess(
  (val) => (val === null || val === '' ? undefined : val),
  z
    .enum(['en', 'he'])
    .optional()
    .describe('UI locale: output language for AI-generated recipe text')
);

const optionalModel = z.preprocess(
  (val) => (val === null || val === '' ? undefined : val),
  z
    .string()
    .max(120)
    .optional()
    .describe(
      'Override LLM: automatic, gemini_3_flash, gemini_3_1_pro, or raw gpt-* / gemini-* (may cost more credits)'
    )
);

export const generateSchema = z.object({
  prompt: z.string().min(3).max(500),
  cuisine: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  servings: z.number().int().positive().optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  locale: optionalLocale,
  model: optionalModel,
});

export const modifySchema = z.object({
  recipeId: z.string().uuid(),
  modification: z.string().min(3).max(500),
  model: optionalModel,
});

export const importTextSchema = z.object({
  text: z.string().min(10).max(10000),
  locale: optionalLocale,
  model: optionalModel,
});

export const importUrlSchema = z.object({
  url: z.preprocess(
    (val) => (typeof val === 'string' ? normalizeImportUrl(val) : val),
    z.string().url()
  ),
  locale: optionalLocale,
  model: optionalModel,
});

export const importImageSchema = z.object({
  imageUrl: z.string().url(),
  locale: optionalLocale,
  model: optionalModel,
});

export const chatSchema = z.object({
  recipeId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  locale: optionalLocale,
  model: optionalModel,
});
