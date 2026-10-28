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

  // 2. Robust Cross-Origin Resource Sharing (CORS) Configuration
  const isOriginAllowed = (origin) => {
    // Allow non-browser requests (mobile apps, curl, server-to-server health checks)
    if (!origin) return true;

    const normalizedOrigin = origin.trim().replace(/\/+$/, '');

    // Check configured CORS_ORIGIN (supports comma-separated list)
    if (env.CORS_ORIGIN) {
      if (env.CORS_ORIGIN === '*') return true;
      const configuredOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, ''));
      if (configuredOrigins.includes(normalizedOrigin)) {
        return true;
      }
    }

    // Always allow local development
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) {
      return true;
    }

    // Automatically allow Vercel deployments (*.vercel.app)
    if (/^https:\/\/.*\.vercel\.app$/.test(normalizedOrigin)) {
      return true;
    }

    // Automatically allow Render deployments (*.onrender.com)
    if (/^https:\/\/.*\.onrender\.com$/.test(normalizedOrigin)) {
      return true;
    }

    return false;
  };

  const corsOptions = {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        logger.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-step-up-token', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Disposition', 'X-Total-Rows'],
    optionsSuccessStatus: 200,
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

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
  app.use('/api/v1/', apiRateLimiter);

  // 6. Mount REST API Routes (supports /api/v1, /api, and root paths for frontend flexibility)
  app.use('/api/v1', apiV1Routes);
  app.use('/api', apiV1Routes);
  app.use('/', apiV1Routes);

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
