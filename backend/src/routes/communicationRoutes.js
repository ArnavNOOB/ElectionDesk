import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/rbacMiddleware.js';
import {
  handleInitiateCall,
  handleGetCall,
  handleSendWhatsAppMessage,
  handleGetHistory,
  handleGetTemplates,
  handleUpdateConsent,
} from '../controllers/communicationController.js';

const router = Router();

// All communication endpoints require valid authentication session
router.use(requireAuth);

// Voice Calling
router.post(
  '/calls',
  requireRole('SUPER_ADMIN', 'DATA_ADMIN', 'DATA_ENTRY_OPERATOR'),
  handleInitiateCall
);

router.get(
  '/calls/:id',
  requireRole('SUPER_ADMIN', 'DATA_ADMIN', 'DATA_ENTRY_OPERATOR', 'AUDITOR'),
  handleGetCall
);

// WhatsApp Messaging
router.post(
  '/whatsapp/messages',
  requireRole('SUPER_ADMIN', 'DATA_ADMIN', 'DATA_ENTRY_OPERATOR'),
  handleSendWhatsAppMessage
);

// Communication History for Voter Record
router.get(
  '/history/:recordId',
  requireRole('SUPER_ADMIN', 'DATA_ADMIN', 'DATA_ENTRY_OPERATOR', 'AUDITOR'),
  handleGetHistory
);

// Pre-Approved Templates List
router.get('/templates', handleGetTemplates);

// Consent & Preferences Management
router.post(
  '/consent/:recordId',
  requireRole('SUPER_ADMIN', 'DATA_ADMIN', 'DATA_ENTRY_OPERATOR'),
  handleUpdateConsent
);

export default router;
