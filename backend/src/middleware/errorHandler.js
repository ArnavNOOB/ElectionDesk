import { ApiResponse } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  // If response has already started sending
  if (res.headersSent) {
    return next(err);
  }

  // Handle Zod schema validation errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return ApiResponse.error(res, 'Validation error', 400, 'VALIDATION_FAILED', formattedErrors);
  }

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return ApiResponse.error(res, 'Uploaded file exceeds the maximum 5MB size limit', 400, 'FILE_TOO_LARGE');
    }
    return ApiResponse.error(res, err.message, 400, 'UPLOAD_ERROR');
  }

  // Log error
  logger.error(`Unhandled API Error on [${req.method}] ${req.originalUrl}`, err);

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'An internal security exception occurred. Please try again later.'
    : err.message || 'Internal Server Error';

  return ApiResponse.error(res, message, statusCode, err.code || 'INTERNAL_ERROR');
}
