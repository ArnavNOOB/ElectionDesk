import { dbStore } from '../services/store.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { logAuditEvent } from '../services/auditService.js';

export async function handleGetGovernancePolicy(req, res, next) {
  try {
    const policy = await dbStore.governance.getPolicy();
    return ApiResponse.success(res, policy, 'Data governance policy retrieved');
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateGovernancePolicy(req, res, next) {
  try {
    const updated = await dbStore.governance.updatePolicy(req.body);
    await logAuditEvent({
      actor: req.user,
      action: 'POLICY_UPDATE',
      entityType: 'SYSTEM',
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      details: { policyName: updated.policyName },
    });
    return ApiResponse.success(res, updated, 'Data governance policy updated');
  } catch (error) {
    next(error);
  }
}

export async function handleRunRetentionPurge(req, res, next) {
  try {
    const policy = await dbStore.governance.getPolicy();
    const purgeThreshold = new Date(Date.now() - (policy.archivedPurgeDays || 90) * 24 * 60 * 60 * 1000);

    const { records: archived } = await dbStore.voters.query({ filter: { isArchived: true }, limit: 1000 });
    let purgedCount = 0;

    for (const v of archived) {
      if (v.archivedAt && new Date(v.archivedAt) <= purgeThreshold) {
        // Permanently purge record
        await dbStore.voters.updateOne({ _id: v._id || v.id }, { $set: { isPurged: true } });
        purgedCount++;
      }
    }

    await logAuditEvent({
      actor: req.user,
      action: 'RETENTION_PURGE',
      entityType: 'SYSTEM',
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      details: { purgedCount, thresholdDays: policy.archivedPurgeDays },
    });

    return ApiResponse.success(res, { purgedCount }, `Retention policy applied. ${purgedCount} archived records purged.`);
  } catch (error) {
    next(error);
  }
}
