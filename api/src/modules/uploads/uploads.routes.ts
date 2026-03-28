import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { getPresignedUrl, getFileUrl } from './uploads.controller';

const router = Router();

router.use(authenticate);

router.post('/url', getPresignedUrl);
router.get('/url', getFileUrl);

export default router;
