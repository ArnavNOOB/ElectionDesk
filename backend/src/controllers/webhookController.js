import { env } from '../config/env.js';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  verifyWhatsAppSignature,
  processWhatsAppWebhook,
  processVoiceWebhook,
} from '../services/communicationService.js';
import { logger } from '../utils/logger.js';

/**
 * Meta WhatsApp Cloud API Webhook Challenge Verification (GET)
 */
export async function handleWhatsAppWebhookGet(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    logger.info('[WhatsAppWebhook] Verification challenge accepted.');
    return res.status(200).send(challenge);
  }

  logger.warn('[WhatsAppWebhook] Verification challenge failed: invalid verify token.');
  return res.status(403).send('Verification token mismatch');
}

/**
 * Meta WhatsApp Cloud API Event Ingestion (POST)
 */
export async function handleWhatsAppWebhookPost(req, res, next) {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = JSON.stringify(req.body);

    // If app secret is configured and in production, verify HMAC signature
    if (env.WHATSAPP_WEBHOOK_APP_SECRET && signature) {
      const isValid = verifyWhatsAppSignature(rawBody, signature, env.WHATSAPP_WEBHOOK_APP_SECRET);
      if (!isValid) {
        logger.warn('[WhatsAppWebhook] Invalid HMAC SHA256 signature rejected.');
        return ApiResponse.error(res, 'Invalid webhook signature', 401, 'INVALID_SIGNATURE');
      }
    }

    const result = await processWhatsAppWebhook(req.body);
    return ApiResponse.success(res, result, 'WhatsApp webhook processed successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * Voice Telephony Call Status Callback Ingestion (POST)
 */
export async function handleVoiceWebhookPost(req, res, next) {
  try {
    const signature = req.headers['x-voice-signature'] || req.headers['x-twilio-signature'];

    // If voice webhook secret is configured, optional signature validation
    if (env.VOICE_WEBHOOK_SECRET && signature && signature !== env.VOICE_WEBHOOK_SECRET) {
      logger.warn('[VoiceWebhook] Signature mismatch on voice status callback.');
      return ApiResponse.error(res, 'Invalid voice webhook signature', 401, 'INVALID_SIGNATURE');
    }

    const result = await processVoiceWebhook(req.body);
    return ApiResponse.success(res, result, 'Voice status update processed successfully');
  } catch (error) {
    next(error);
  }
}
