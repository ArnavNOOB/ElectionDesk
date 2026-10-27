import { Router } from 'express';
import {
  handleWhatsAppWebhookGet,
  handleWhatsAppWebhookPost,
  handleVoiceWebhookPost,
} from '../controllers/webhookController.js';

const router = Router();

// Meta WhatsApp Webhook Endpoints
router.get('/whatsapp', handleWhatsAppWebhookGet);
router.post('/whatsapp', handleWhatsAppWebhookPost);

// Telephony Voice Call Status Callback Endpoints
router.post('/voice', handleVoiceWebhookPost);

export default router;
