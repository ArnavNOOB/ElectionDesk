import { Router } from 'express';
import {
  handlePreviewImport,
  handleCommitImport,
  handleExportVoters,
  handleDownloadTemplate,
} from '../controllers/importExportController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/rbacMiddleware.js';
import { requireStepUpAuth } from '../middleware/stepUpMiddleware.js';
import { uploadSpreadsheet } from '../middleware/uploadMiddleware.js';
import { exportRateLimiter } from '../middleware/rateLimiter.js';
import { UserRole } from '../models/User.js';

const router = Router();

// Import wizard endpoints
router.get(
  '/template',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN),
  handleDownloadTemplate
);

router.post(
  '/preview',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN),
  uploadSpreadsheet.single('file'),
  handlePreviewImport
);

router.post(
  '/commit',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN),
  handleCommitImport
);

// Export endpoint: requires step-up authentication & export rate limiting
router.get(
  '/voters',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN),
  requireStepUpAuth,
  exportRateLimiter,
  handleExportVoters
);

export default router;
