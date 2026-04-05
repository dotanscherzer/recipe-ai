import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import {
  generateSchema,
  modifySchema,
  importTextSchema,
  importUrlSchema,
  importImageSchema,
  chatSchema,
} from './ai.schemas';
import { generate, modify, importText, importUrl, importImage, chat } from './ai.controller';

const router = Router();

router.use(authenticate);

router.post('/generate', validate(generateSchema), asyncHandler(generate));
router.post('/modify', validate(modifySchema), asyncHandler(modify));
router.post('/import-text', validate(importTextSchema), asyncHandler(importText));
router.post('/import-url', validate(importUrlSchema), asyncHandler(importUrl));
router.post('/import-image', validate(importImageSchema), asyncHandler(importImage));
router.post('/chat', validate(chatSchema), asyncHandler(chat));

export default router;
