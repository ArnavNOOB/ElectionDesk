import { ApiResponse } from '../utils/apiResponse.js';
import { logAuditEvent } from '../services/auditService.js';
import { dbStore } from '../services/store.js';

export function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return ApiResponse.error(res, 'Authentication required', 401, 'UNAUTHORIZED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      await logAuditEvent({
        actor: req.user,
        action: 'ACCESS_DENIED',
        entityType: 'SECURITY',
        outcome: 'DENIED',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        details: {
          path: req.originalUrl,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
        },
      });

      await dbStore.securityEvents.create({
        eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        severity: 'MEDIUM',
        sourceIp: req.ip || '127.0.0.1',
        details: {
          userId: req.user._id || req.user.id,
          role: req.user.role,
          attemptedEndpoint: req.originalUrl,
        },
      });

      return ApiResponse.error(
        res,
        `Access denied. Your role '${req.user.role}' is not authorized to perform this action.`,
        403,
        'FORBIDDEN'
      );
    }

    next();
  };
}
