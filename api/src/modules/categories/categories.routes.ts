import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { createCategorySchema, updateCategorySchema } from './categories.schemas';
import { listCategories, createCategory, updateCategory, deleteCategory } from './categories.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listCategories));
router.post('/', validate(createCategorySchema), asyncHandler(createCategory));
router.put('/:id', validate(updateCategorySchema), asyncHandler(updateCategory));
router.delete('/:id', asyncHandler(deleteCategory));

export default router;
