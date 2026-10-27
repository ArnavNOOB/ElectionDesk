import { Router } from 'express';
import { handleGetSecurityHealth, handleResolveSecurityEvent } from '../controllers/securityController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/rbacMiddleware.js';
import { UserRole } from '../models/User.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(UserRole.SUPER_ADMIN));

router.get('/health', handleGetSecurityHealth);
router.patch('/events/:id/resolve', handleResolveSecurityEvent);

export default router;
