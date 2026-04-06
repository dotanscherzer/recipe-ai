import { z } from 'zod';

const optionalModel = z
  .string()
  .max(120)
  .optional()
  .describe(
    'Override LLM: automatic, gemini_3_flash, gemini_3_1_pro, or raw gpt-* / gemini-* (may cost more credits)'
  );

export const generateSchema = z.object({
  prompt: z.string().min(3).max(500),
  cuisine: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  servings: z.number().int().positive().optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  model: optionalModel,
});

export const modifySchema = z.object({
  recipeId: z.string().uuid(),
  modification: z.string().min(3).max(500),
  model: optionalModel,
});

export const importTextSchema = z.object({
  text: z.string().min(10).max(10000),
  model: optionalModel,
});

export const importUrlSchema = z.object({
  url: z.string().url(),
  model: optionalModel,
});

export const importImageSchema = z.object({
  imageUrl: z.string().url(),
  model: optionalModel,
});

export const chatSchema = z.object({
  recipeId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
  model: optionalModel,
});
