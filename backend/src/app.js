import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { configureSecurityHeaders } from './middleware/securityHeaders.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { sanitizeMongoInput } from './utils/sanitize.js';
import apiV1Routes from './routes/index.js';

export function createApp() {
  const app = express();

  // 1. Transport & Browser Security Headers
  app.use(configureSecurityHeaders());

  // 2. CORS allowlist
  app.use(
    cors({
      origin: [env.CORS_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-step-up-token'],
      exposedHeaders: ['Content-Disposition', 'X-Total-Rows'],
    })
  );

  // 3. Body parsers with bounded request size (protection against buffer overflow / memory exhaustion)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // 4. Request sanitization to prevent NoSQL injection
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeMongoInput(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeMongoInput(req.query);
    }
    next();
  });

  // 5. Global API Rate Limiter
  app.use('/api/', apiRateLimiter);

  // 6. Mount REST API Version 1
  app.use('/api/v1', apiV1Routes);

  // 7. API Root Welcome / Documentation info
  app.get('/', (req, res) => {
    res.json({
      service: 'ElectionDesk — Secure Voter Information Management System',
      version: '1.0.0',
      apiDoc: '/api/v1/health',
      compliance: 'DPDP Act 2023 & Electoral Roll Administration Baseline',
    });
  });

  // 8. 404 Not Found Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Endpoint '${req.originalUrl}' does not exist on this server.`,
      },
    });
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export default createApp;
