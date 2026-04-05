import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { saveRecipeSchema, updateSavedRecipeSchema } from './saved-recipes.schemas';
import { listSavedRecipes, saveRecipe, updateSavedRecipe, deleteSavedRecipe } from './saved-recipes.controller';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(listSavedRecipes));
router.post('/', validate(saveRecipeSchema), asyncHandler(saveRecipe));
router.put('/:id', validate(updateSavedRecipeSchema), asyncHandler(updateSavedRecipe));
router.delete('/:id', asyncHandler(deleteSavedRecipe));

export default router;
