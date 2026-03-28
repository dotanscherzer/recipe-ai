import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { saveRecipeSchema, updateSavedRecipeSchema } from './saved-recipes.schemas';
import { listSavedRecipes, saveRecipe, updateSavedRecipe, deleteSavedRecipe } from './saved-recipes.controller';

const router = Router();

router.use(authenticate);

router.get('/', listSavedRecipes);
router.post('/', validate(saveRecipeSchema), saveRecipe);
router.put('/:id', validate(updateSavedRecipeSchema), updateSavedRecipe);
router.delete('/:id', deleteSavedRecipe);

export default router;
