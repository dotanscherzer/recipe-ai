import { Response } from 'express';
import { prisma } from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';

export async function listSavedRecipes(req: AuthRequest, res: Response) {
  const savedRecipes = await prisma.savedRecipe.findMany({
    where: { userId: req.userId },
    include: {
      recipe: true,
      category: true,
    },
  });

  res.json({ savedRecipes });
}

export async function saveRecipe(req: AuthRequest, res: Response) {
  const { recipeId, isFavorite, categoryId, personalNotes, rating } = req.body;

  const savedRecipe = await prisma.savedRecipe.create({
    data: {
      userId: req.userId!,
      recipeId,
      isFavorite,
      categoryId,
      personalNotes,
      rating,
    },
    include: {
      recipe: true,
      category: true,
    },
  });

  res.status(201).json({ savedRecipe });
}

export async function updateSavedRecipe(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const existing = await prisma.savedRecipe.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Saved recipe not found');
  }
  if (existing.userId !== req.userId) {
    throw new AppError(403, 'Not authorized to update this saved recipe');
  }

  const savedRecipe = await prisma.savedRecipe.update({
    where: { id },
    data: req.body,
    include: {
      recipe: true,
      category: true,
    },
  });

  res.json({ savedRecipe });
}

export async function deleteSavedRecipe(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const existing = await prisma.savedRecipe.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Saved recipe not found');
  }
  if (existing.userId !== req.userId) {
    throw new AppError(403, 'Not authorized to delete this saved recipe');
  }

  await prisma.savedRecipe.delete({ where: { id } });

  res.json({ message: 'Saved recipe deleted successfully' });
}
