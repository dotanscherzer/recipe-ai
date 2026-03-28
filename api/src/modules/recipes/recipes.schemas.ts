import { z } from 'zod';

const ingredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  amount: z.string().min(1, 'Amount is required'),
  unit: z.string().min(1, 'Unit is required'),
});

export const createRecipeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: z.string().optional(),
  ingredients: z.array(ingredientSchema).min(1, 'At least one ingredient is required'),
  steps: z.array(z.string().min(1, 'Step cannot be empty')).min(1, 'At least one step is required'),
  tags: z.array(z.string()).default([]),
  prepTime: z.number().int().positive('Prep time must be positive').optional(),
  cookTime: z.number().int().positive('Cook time must be positive').optional(),
  servings: z.number().int().positive('Servings must be positive').optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  cuisine: z.string().optional(),
  imageUrl: z.string().url('Invalid URL').optional(),
  isAiGenerated: z.boolean().default(false),
  isPublic: z.boolean().default(true),
});

export const updateRecipeSchema = createRecipeSchema.partial();

export const searchRecipeSchema = z.object({
  q: z.string().optional(),
  ingredients: z.string().optional(),
  cuisine: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50, 'Limit must be 50 or less').default(20),
});
