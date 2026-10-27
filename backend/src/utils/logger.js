import { redactSensitiveData } from './sanitize.js';

export const logger = {
  info(message, meta = {}) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      meta: redactSensitiveData(meta),
    }));
  },

  warn(message, meta = {}) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      meta: redactSensitiveData(meta),
    }));
  },

  error(message, error = null, meta = {}) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      error: error?.message || error,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      meta: redactSensitiveData(meta),
    }));
  },

  security(eventType, message, meta = {}) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'SECURITY_ALERT',
      eventType,
      message,
      meta: redactSensitiveData(meta),
    }));
  },
};
