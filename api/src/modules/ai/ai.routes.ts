import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
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

router.post('/generate', validate(generateSchema), generate);
router.post('/modify', validate(modifySchema), modify);
router.post('/import-text', validate(importTextSchema), importText);
router.post('/import-url', validate(importUrlSchema), importUrl);
router.post('/import-image', validate(importImageSchema), importImage);
router.post('/chat', validate(chatSchema), chat);

export default router;
