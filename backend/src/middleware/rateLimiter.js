import rateLimit from 'express-rate-limit';
import { ApiResponse } from '../utils/apiResponse.js';
import { dbStore } from '../services/store.js';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    await dbStore.securityEvents.create({
      eventType: 'RATE_LIMIT_EXCEEDED',
      severity: 'MEDIUM',
      sourceIp: req.ip,
      details: { path: req.originalUrl, window: '15m' },
    });
    return ApiResponse.error(
      res,
      'Too many failed authentication attempts. Please try again after 15 minutes.',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  },
});

export const exportRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 exports per 10 mins
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(
      res,
      'Export rate limit exceeded. Please wait before generating another bulk export.',
      429,
      'EXPORT_RATE_LIMIT'
    );
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(res, 'Too many requests. Please slow down.', 429, 'API_RATE_LIMIT');
  },
});
