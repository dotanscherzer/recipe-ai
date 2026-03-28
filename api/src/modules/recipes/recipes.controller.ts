import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { prisma } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';

export async function listRecipes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { cuisine, difficulty, page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { isPublic: true };
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
    const { q, ingredients, cuisine, difficulty, page, limit } = req.query as Record<string, string>;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { isPublic: true };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (cuisine) where.cuisine = cuisine;
    if (difficulty) where.difficulty = difficulty;

    if (ingredients) {
      const ingredientList = ingredients.split(',').map(i => i.trim()).filter(Boolean);
      where.ingredients = {
        string_contains: ingredientList.length === 1
          ? ingredientList[0]
          : undefined,
      };
      // For multiple ingredients, use AND conditions on the JSON field
      if (ingredientList.length > 0) {
        const ingredientConditions = ingredientList.map(ingredient => ({
          ingredients: { string_contains: ingredient },
        }));
        if (where.OR) {
          // Combine text search OR with ingredient AND
          where.AND = ingredientConditions;
        } else {
          where.AND = ingredientConditions;
        }
        delete where.ingredients;
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
