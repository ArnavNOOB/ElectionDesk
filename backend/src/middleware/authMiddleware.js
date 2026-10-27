import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { dbStore } from '../services/store.js';
import { ApiResponse } from '../utils/apiResponse.js';

export async function requireAuth(req, res, next) {
  try {
    let token = null;

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.session_token) {
      token = req.cookies.session_token;
    }

    if (!token) {
      return ApiResponse.error(res, 'Authentication required. No token provided.', 401, 'UNAUTHORIZED');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      return ApiResponse.error(res, 'Invalid or expired session token.', 401, 'TOKEN_EXPIRED');
    }

    const user = await dbStore.users.findById(decoded.userId);
    if (!user) {
      return ApiResponse.error(res, 'User account no longer exists.', 401, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      return ApiResponse.error(res, 'Account has been deactivated.', 403, 'ACCOUNT_DEACTIVATED');
    }

    if (user.sessionVersion !== decoded.sessionVersion) {
      return ApiResponse.error(res, 'Session has been invalidated. Please log in again.', 401, 'SESSION_REVOKED');
    }

    // Attach authenticated user to request
    req.user = user;
    next();
  } catch (error) {
    return ApiResponse.error(res, 'Authentication failure.', 500, 'AUTH_INTERNAL_ERROR');
  }
}
