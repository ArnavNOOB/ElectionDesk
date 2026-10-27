import { Router } from 'express';
import {
  handleLogin,
  handleMfaVerify,
  handleSetupMfa,
  handleStepUpAuth,
  handleGetCurrentUser,
  handleLogout,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/login', authRateLimiter, handleLogin);
router.post('/mfa/verify', authRateLimiter, handleMfaVerify);
router.post('/mfa/setup', requireAuth, handleSetupMfa);
router.post('/step-up', requireAuth, authRateLimiter, handleStepUpAuth);
router.get('/me', requireAuth, handleGetCurrentUser);
router.post('/logout', requireAuth, handleLogout);

export default router;
