import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateMeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  oauthExchangeSchema,
} from './auth.schemas';
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateMe,
  forgotPassword,
  resetPassword,
} from './auth.controller';
import {
  authProviders,
  googleStart,
  googleCallback,
  appleStart,
  appleCallback,
  oauthExchange,
} from './oauth.controller';

const router = Router();

router.get('/providers', asyncHandler(authProviders));
router.get('/google', asyncHandler(googleStart));
router.get('/google/callback', asyncHandler(googleCallback));
router.get('/apple', asyncHandler(appleStart));
router.get('/apple/callback', asyncHandler(appleCallback));
router.post('/oauth/exchange', validate(oauthExchangeSchema), asyncHandler(oauthExchange));

router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(forgotPassword));
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(resetPassword));
router.post('/register', validate(registerSchema), asyncHandler(register));
router.post('/login', validate(loginSchema), asyncHandler(login));
router.post('/refresh', validate(refreshSchema), asyncHandler(refreshToken));
router.post('/logout', authenticate, asyncHandler(logout));
router.get('/me', authenticate, asyncHandler(getMe));
router.put('/me', authenticate, validate(updateMeSchema), asyncHandler(updateMe));

export default router;
