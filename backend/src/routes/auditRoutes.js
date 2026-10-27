import { Router } from 'express';
import { handleListAuditLogs, handleVerifyAuditChain } from '../controllers/auditController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/rbacMiddleware.js';
import { UserRole } from '../models/User.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.AUDITOR),
  handleListAuditLogs
);

router.get(
  '/verify-chain',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.AUDITOR),
  handleVerifyAuditChain
);

export default router;
