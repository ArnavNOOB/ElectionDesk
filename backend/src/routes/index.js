import { Router } from 'express';
import authRoutes from './authRoutes.js';
import voterRoutes from './voterRoutes.js';
import pollingStationRoutes from './pollingStationRoutes.js';
import photoRoutes from './photoRoutes.js';
import importExportRoutes from './importExportRoutes.js';
import auditRoutes from './auditRoutes.js';
import userRoutes from './userRoutes.js';
import reportRoutes from './reportRoutes.js';
import placesRoutes from './placesRoutes.js';
import governanceRoutes from './governanceRoutes.js';
import securityRoutes from './securityRoutes.js';
import communicationRoutes from './communicationRoutes.js';
import webhookRoutes from './webhookRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/voters', voterRoutes);
router.use('/voters', photoRoutes); // Mounts /voters/:voterId/photo
router.use('/polling-stations', pollingStationRoutes);
router.use('/import-export', importExportRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/users', userRoutes);
router.use('/reports', reportRoutes);
router.use('/places', placesRoutes);
router.use('/governance', governanceRoutes);
router.use('/security', securityRoutes);
router.use('/communications', communicationRoutes);
router.use('/webhooks', webhookRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'ElectionDesk API v1',
    timestamp: new Date().toISOString(),
  });
});

export default router;
