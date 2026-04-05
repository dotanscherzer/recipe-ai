import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { registerSchema, loginSchema, refreshSchema, updateMeSchema } from './auth.schemas';
import { register, login, refreshToken, logout, getMe, updateMe } from './auth.controller';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(register));
router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/refresh', validate(refreshSchema), asyncHandler(refreshToken));
router.post('/logout', authenticate, asyncHandler(logout));
router.get('/me', authenticate, asyncHandler(getMe));
router.put('/me', authenticate, validate(updateMeSchema), asyncHandler(updateMe));

export default router;
