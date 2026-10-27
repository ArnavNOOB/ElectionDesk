import { Router } from 'express';
import {
  handleListUsers,
  handleCreateUser,
  handleUpdateUserRole,
  handleToggleUserStatus,
  handleResetUserMfa,
} from '../controllers/userController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/rbacMiddleware.js';
import { requireStepUpAuth } from '../middleware/stepUpMiddleware.js';
import { UserRole } from '../models/User.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole(UserRole.SUPER_ADMIN));

router.get('/', handleListUsers);
router.post('/', handleCreateUser);
router.put('/:id/role', requireStepUpAuth, handleUpdateUserRole);
router.patch('/:id/status', handleToggleUserStatus);
router.post('/:id/reset-mfa', handleResetUserMfa);

export default router;
