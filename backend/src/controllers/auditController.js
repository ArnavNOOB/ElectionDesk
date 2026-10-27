import { getAuditLogs, verifyAuditChainIntegrity } from '../services/auditService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export async function handleListAuditLogs(req, res, next) {
  try {
    const { page = 1, limit = 50, action, entityType, actorEmail, outcome } = req.query;

    const { logs, total } = await getAuditLogs({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 200),
      action,
      entityType,
      actorEmail,
      outcome,
    });

    return ApiResponse.success(res, logs, 'Audit records retrieved', 200, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleVerifyAuditChain(req, res, next) {
  try {
    const result = await verifyAuditChainIntegrity();
    return ApiResponse.success(res, result, 'Cryptographic audit log verification completed');
  } catch (error) {
    next(error);
  }
}
