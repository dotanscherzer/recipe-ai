import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createCategorySchema, updateCategorySchema } from './categories.schemas';
import { listCategories, createCategory, updateCategory, deleteCategory } from './categories.controller';

const router = Router();

router.use(authenticate);

router.get('/', listCategories);
router.post('/', validate(createCategorySchema), createCategory);
router.put('/:id', validate(updateCategorySchema), updateCategory);
router.delete('/:id', deleteCategory);

export default router;
