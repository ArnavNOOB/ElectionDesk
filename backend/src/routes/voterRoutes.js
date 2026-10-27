import { Router } from 'express';
import {
  handleListVoters,
  handleGetVoter,
  handleCreateVoter,
  handleUpdateVoter,
  handleArchiveVoter,
  handleRestoreVoter,
  handleCheckDuplicates,
  handleListFamilyHeads,
} from '../controllers/voterController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/rbacMiddleware.js';
import { UserRole } from '../models/User.js';

const router = Router();

// Read operations permitted for all authenticated roles
router.get(
  '/',
  requireAuth,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.DATA_ADMIN,
    UserRole.DATA_ENTRY_OPERATOR,
    UserRole.AUDITOR,
    UserRole.READ_ONLY
  ),
  handleListVoters
);

router.get(
  '/family-heads',
  requireAuth,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.DATA_ADMIN,
    UserRole.DATA_ENTRY_OPERATOR,
    UserRole.AUDITOR,
    UserRole.READ_ONLY
  ),
  handleListFamilyHeads
);

router.get(
  '/:id',
  requireAuth,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.DATA_ADMIN,
    UserRole.DATA_ENTRY_OPERATOR,
    UserRole.AUDITOR,
    UserRole.READ_ONLY
  ),
  handleGetVoter
);

router.post(
  '/check-duplicates',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN, UserRole.DATA_ENTRY_OPERATOR),
  handleCheckDuplicates
);

// Create record
router.post(
  '/',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN, UserRole.DATA_ENTRY_OPERATOR),
  handleCreateVoter
);

// Update record
router.put(
  '/:id',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN, UserRole.DATA_ENTRY_OPERATOR),
  handleUpdateVoter
);

// Archive (Soft-delete)
router.post(
  '/:id/archive',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN),
  handleArchiveVoter
);

// Restore
router.post(
  '/:id/restore',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN),
  handleRestoreVoter
);

export default router;
