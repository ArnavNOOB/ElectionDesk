import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root or parent
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5001', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/electiondesk',
  JWT_SECRET: process.env.JWT_SECRET || 'electiondesk_jwt_super_secure_secret_key_2026_change_in_prod!',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  STEP_UP_JWT_SECRET: process.env.STEP_UP_JWT_SECRET || 'electiondesk_step_up_secret_key_2026!',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'electiondesk_cookie_secret_key_2026!',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  STORAGE_DIR: process.env.STORAGE_DIR || path.resolve(__dirname, '../../storage/voter_photos'),
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
  USE_IN_MEMORY_DB: process.env.USE_IN_MEMORY_DB === 'true' || false,
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 mins
  RATE_LIMIT_MAX_REQUESTS: 200,

  // Communication & Telephony Configuration
  WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN || '',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'electiondesk_wa_verify_token_2026',
  WHATSAPP_WEBHOOK_APP_SECRET: process.env.WHATSAPP_WEBHOOK_APP_SECRET || 'electiondesk_wa_app_secret_2026',
  VOICE_PROVIDER: process.env.VOICE_PROVIDER || 'MOCK', // 'TWILIO' | 'EXOTEL' | 'PLIVO' | 'MOCK'
  VOICE_ACCOUNT_SID: process.env.VOICE_ACCOUNT_SID || '',
  VOICE_AUTH_TOKEN: process.env.VOICE_AUTH_TOKEN || '',
  VOICE_CALLER_ID: process.env.VOICE_CALLER_ID || '+911752220000', // Official Patiala Urban Election Control Room Caller ID
  VOICE_WEBHOOK_SECRET: process.env.VOICE_WEBHOOK_SECRET || 'electiondesk_voice_webhook_secret_2026',
  COMMUNICATION_RATE_LIMIT_PER_MINUTE: parseInt(process.env.COMMUNICATION_RATE_LIMIT_PER_MINUTE || '20', 10),
  COMMUNICATION_DAILY_LIMIT_PER_RECORD: parseInt(process.env.COMMUNICATION_DAILY_LIMIT_PER_RECORD || '5', 10),
};
