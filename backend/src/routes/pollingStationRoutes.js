import { Router } from 'express';
import {
  handleListPollingStations,
  handleGetPollingStation,
  handleCreatePollingStation,
  handleUpdatePollingStation,
  handleGetBoothSummary,
} from '../controllers/pollingStationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/rbacMiddleware.js';
import { UserRole } from '../models/User.js';

const router = Router();

router.get(
  '/summary',
  requireAuth,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.DATA_ADMIN,
    UserRole.DATA_ENTRY_OPERATOR,
    UserRole.AUDITOR,
    UserRole.READ_ONLY
  ),
  handleGetBoothSummary
);

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
  handleListPollingStations
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
  handleGetPollingStation
);

router.post(
  '/',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN),
  handleCreatePollingStation
);

router.put(
  '/:id',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN),
  handleUpdatePollingStation
);

export default router;
