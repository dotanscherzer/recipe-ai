import { Response } from 'express';
import { prisma } from '../../config/db';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';

export async function listCategories(req: AuthRequest, res: Response) {
  const categories = await prisma.category.findMany({
    where: { userId: req.userId },
    include: {
      _count: {
        select: { savedRecipes: true },
      },
    },
  });

  res.json({ categories });
}

export async function createCategory(req: AuthRequest, res: Response) {
  const { name, color, icon } = req.body;

  const category = await prisma.category.create({
    data: {
      userId: req.userId!,
      name,
      color,
      icon,
    },
  });

  res.status(201).json({ category });
}

export async function updateCategory(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Category not found');
  }
  if (existing.userId !== req.userId) {
    throw new AppError(403, 'Not authorized to update this category');
  }

  const category = await prisma.category.update({
    where: { id },
    data: req.body,
  });

  res.json({ category });
}

export async function deleteCategory(req: AuthRequest, res: Response) {
  const { id } = req.params;

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Category not found');
  }
  if (existing.userId !== req.userId) {
    throw new AppError(403, 'Not authorized to delete this category');
  }

  await prisma.category.delete({ where: { id } });

  res.json({ message: 'Category deleted successfully' });
}
