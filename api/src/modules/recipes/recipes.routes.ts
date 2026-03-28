import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createRecipeSchema, updateRecipeSchema, searchRecipeSchema } from './recipes.schemas';
import {
  listRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  searchRecipes,
} from './recipes.controller';

const router = Router();

router.get('/', listRecipes);
router.get('/search', validate(searchRecipeSchema, 'query'), searchRecipes);
router.get('/:id', getRecipe);
router.post('/', authenticate, validate(createRecipeSchema), createRecipe);
router.put('/:id', authenticate, validate(updateRecipeSchema), updateRecipe);
router.delete('/:id', authenticate, deleteRecipe);

export default router;
