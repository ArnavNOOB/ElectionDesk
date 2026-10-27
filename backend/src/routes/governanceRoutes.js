import { Router } from 'express';
import {
  handleGetGovernancePolicy,
  handleUpdateGovernancePolicy,
  handleRunRetentionPurge,
} from '../controllers/governanceController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/rbacMiddleware.js';
import { requireStepUpAuth } from '../middleware/stepUpMiddleware.js';
import { UserRole } from '../models/User.js';

const router = Router();

router.use(requireAuth);

router.get('/', handleGetGovernancePolicy);
router.put('/', requireRole(UserRole.SUPER_ADMIN), requireStepUpAuth, handleUpdateGovernancePolicy);
router.post('/purge', requireRole(UserRole.SUPER_ADMIN), requireStepUpAuth, handleRunRetentionPurge);

export default router;
