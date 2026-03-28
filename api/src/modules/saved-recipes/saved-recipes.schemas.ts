import { z } from 'zod';

export const saveRecipeSchema = z.object({
  recipeId: z.string().uuid(),
  isFavorite: z.boolean().default(false),
  categoryId: z.string().uuid().optional(),
  personalNotes: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export const updateSavedRecipeSchema = saveRecipeSchema
  .partial()
  .omit({ recipeId: true });
