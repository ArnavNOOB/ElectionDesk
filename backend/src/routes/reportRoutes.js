import { Router } from 'express';
import { handleGetDashboardMetrics } from '../controllers/reportController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/dashboard', requireAuth, handleGetDashboardMetrics);

export default router;
