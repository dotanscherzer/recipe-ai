import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/auth';
import { prisma } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { listRecipeSchema, searchRecipeSchema } from './recipes.schemas';

type ListRecipeQuery = z.infer<typeof listRecipeSchema>;

export async function listRecipes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const q = req.query as unknown as ListRecipeQuery;
    const pageNum = Math.max(1, q.page);
    const limitNum = Math.min(50, Math.max(1, q.limit));
    const skip = (pageNum - 1) * limitNum;

    const { cuisine, difficulty, createdBy } = q;

    let where: Record<string, unknown>;

    if (createdBy) {
      const isOwner = req.userId === createdBy;
      const isAdmin = req.userRole === 'ADMIN';
      if (!isOwner && !isAdmin) {
        throw new AppError(403, 'You can only list your own recipes with this filter');
      }
      where = { createdById: createdBy };
    } else {
      where = { isPublic: true };
    }

    if (cuisine) where.cuisine = cuisine;
    if (difficulty) where.difficulty = difficulty;

    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
      }),
      prisma.recipe.count({ where }),
    ]);

    res.json({
      data: recipes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getRecipe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    if (!recipe) {
      throw new AppError(404, 'Recipe not found');
    }

    if (!recipe.isPublic) {
      const canView =
        req.userId &&
        (recipe.createdById === req.userId || req.userRole === 'ADMIN');
      if (!canView) {
        throw new AppError(404, 'Recipe not found');
      }
    }

    // Check saved status for authenticated user (optional auth via header)
    let savedRecipe = null;
    if (req.userId) {
      savedRecipe = await prisma.savedRecipe.findUnique({
        where: {
          userId_recipeId: {
            userId: req.userId,
            recipeId: id,
          },
        },
      });
    }

    res.json({ data: { ...recipe, savedRecipe } });
  } catch (err) {
    next(err);
  }
}

export async function createRecipe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const recipe = await prisma.recipe.create({
      data: {
        ...req.body,
        createdById: req.userId!,
      },
      include: {
        createdBy: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    res.status(201).json({ data: recipe });
  } catch (err) {
    next(err);
  }
}

export async function updateRecipe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Recipe not found');
    }

    if (existing.createdById !== req.userId && req.userRole !== 'ADMIN') {
      throw new AppError(403, 'You do not have permission to update this recipe');
    }

    const recipe = await prisma.recipe.update({
      where: { id },
      data: req.body,
      include: {
        createdBy: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    res.json({ data: recipe });
  } catch (err) {
    next(err);
  }
}

export async function deleteRecipe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Recipe not found');
    }

    if (existing.createdById !== req.userId && req.userRole !== 'ADMIN') {
      throw new AppError(403, 'You do not have permission to delete this recipe');
    }

    await prisma.recipe.delete({ where: { id } });

    res.json({ message: 'Recipe deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function searchRecipes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const parsed = req.query as unknown as z.infer<typeof searchRecipeSchema>;
    const { q: searchQ, ingredients, cuisine, difficulty, page, limit } = parsed;
    const pageNum = page;
    const limitNum = limit;
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { isPublic: true };

    if (searchQ) {
      // Match title/description and ingredient names (stored as JSON); keyword-only search used to miss many recipes.
      where.OR = [
        { title: { contains: searchQ, mode: 'insensitive' } },
        { description: { contains: searchQ, mode: 'insensitive' } },
        { ingredients: { string_contains: searchQ, mode: 'insensitive' } },
      ];
    }

    if (cuisine) where.cuisine = cuisine;
    if (difficulty) where.difficulty = difficulty;

    if (ingredients) {
      const ingredientList = ingredients.split(',').map(i => i.trim()).filter(Boolean);
      if (ingredientList.length > 0) {
        const ingredientClauses = ingredientList.map((ingredient) => ({
          ingredients: { string_contains: ingredient },
        }));
        const prevAnd = where.AND;
        const andArray = Array.isArray(prevAnd) ? [...prevAnd] : prevAnd ? [prevAnd] : [];
        where.AND = [...andArray, ...ingredientClauses];
      }
    }

    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
      }),
      prisma.recipe.count({ where }),
    ]);

    res.json({
      data: recipes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}
