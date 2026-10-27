import { dbStore } from './store.js';
import { calculateSha256 } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

const GENESIS_HASH = 'GENESIS_HASH_000000000000000000000000000000000000000000000000000000000000';

export async function logAuditEvent({
  actor = null,
  action,
  entityType,
  entityId = null,
  outcome = 'SUCCESS',
  ipAddress = '127.0.0.1',
  userAgent = '',
  details = {},
}) {
  try {
    const lastRecord = await dbStore.auditLogs.getLastRecord();
    const previousHash = lastRecord ? lastRecord.recordHash : GENESIS_HASH;
    const timestamp = new Date();

    const actorId = actor?._id || actor?.id || null;
    const actorEmail = actor?.email || 'SYSTEM';
    const actorRole = actor?.role || 'ANONYMOUS';

    // Hash chaining payload
    const hashPayload = JSON.stringify({
      previousHash,
      timestamp: timestamp.toISOString(),
      actorId: actorId ? String(actorId) : 'SYSTEM',
      actorEmail,
      actorRole,
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      outcome,
      ipAddress,
      details,
    });

    const recordHash = calculateSha256(hashPayload);

    const auditEntry = await dbStore.auditLogs.create({
      timestamp,
      actorId,
      actorEmail,
      actorRole,
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      outcome,
      ipAddress,
      userAgent,
      details,
      previousHash,
      recordHash,
    });

    return auditEntry;
  } catch (error) {
    // Audit logging must fail-safe: log to system error stream
    logger.error('CRITICAL: Audit logging failure', error);
  }
}

export async function getAuditLogs({ page = 1, limit = 50, action, entityType, actorEmail, outcome }) {
  const filter = {};
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;
  if (actorEmail) filter.actorEmail = { $regex: actorEmail, $options: 'i' };
  if (outcome) filter.outcome = outcome;

  const skip = (page - 1) * limit;
  return dbStore.auditLogs.query({ filter, skip, limit });
}

/**
 * Verify cryptographic hash integrity of the audit log chain
 */
export async function verifyAuditChainIntegrity(limit = 100) {
  const { logs } = await dbStore.auditLogs.query({ filter: {}, skip: 0, limit });
  if (logs.length <= 1) return { valid: true, verifiedCount: logs.length, brokenAt: null };

  // Logs are sorted newest to oldest. Reverse to check from oldest to newest.
  const ordered = [...logs].reverse();
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const curr = ordered[i];
    if (curr.previousHash !== prev.recordHash) {
      return {
        valid: false,
        verifiedCount: i,
        brokenAt: curr.id || curr._id,
        expectedPreviousHash: prev.recordHash,
        actualPreviousHash: curr.previousHash,
      };
    }
  }

  return { valid: true, verifiedCount: logs.length, brokenAt: null };
}
