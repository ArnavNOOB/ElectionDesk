import { Router } from 'express';
import { handleUploadPhoto, handleGetPhoto, handleDeletePhoto } from '../controllers/photoController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/rbacMiddleware.js';
import { uploadPhoto } from '../middleware/uploadMiddleware.js';
import { UserRole } from '../models/User.js';

const router = Router();

router.post(
  '/:voterId/photo',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN, UserRole.DATA_ENTRY_OPERATOR),
  uploadPhoto.single('photo'),
  handleUploadPhoto
);

router.get(
  '/:voterId/photo',
  requireAuth,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.DATA_ADMIN,
    UserRole.DATA_ENTRY_OPERATOR,
    UserRole.AUDITOR
  ),
  handleGetPhoto
);

router.delete(
  '/:voterId/photo',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN),
  handleDeletePhoto
);

export default router;
