import { describe, it, expect, beforeEach } from 'vitest';
import { dbStore } from '../src/services/store.js';
import { seedDatabase } from './helpers/testFixtures.js';
import { requireRole } from '../src/middleware/rbacMiddleware.js';
import { requireStepUpAuth } from '../src/middleware/stepUpMiddleware.js';
import { verifyAuditChainIntegrity, logAuditEvent } from '../src/services/auditService.js';
import { UserRole } from '../src/models/User.js';
import { generateStepUpToken } from '../src/services/authService.js';

describe('RBAC & Backend Security Controls Tests (ASVS Baseline)', () => {
  beforeEach(async () => {
    dbStore.clearMemoryStore();
    await seedDatabase();
  });

  it('allows access when user has permitted role', async () => {
    const operator = await dbStore.users.findOne({ email: 'operator@electiondesk.gov' });
    const mw = requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN, UserRole.DATA_ENTRY_OPERATOR);

    const req = { user: operator, ip: '127.0.0.1', headers: {}, originalUrl: '/api/v1/voters' };
    let calledNext = false;
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
    };

    await mw(req, res, () => { calledNext = true; });
    expect(calledNext).toBe(true);
  });

  it('NEGATIVE TEST: blocks READ_ONLY role from voter creation (403 FORBIDDEN)', async () => {
    const readOnlyUser = await dbStore.users.findOne({ email: 'readonly@electiondesk.gov' });
    const mw = requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN, UserRole.DATA_ENTRY_OPERATOR);

    const req = { user: readOnlyUser, ip: '127.0.0.1', headers: {}, originalUrl: '/api/v1/voters' };
    let calledNext = false;
    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseBody = data; return this; },
    };

    await mw(req, res, () => { calledNext = true; });
    expect(calledNext).toBe(false);
    expect(statusCode).toBe(403);
    expect(responseBody.error.code).toBe('FORBIDDEN');
  });

  it('NEGATIVE TEST: blocks DATA_ENTRY_OPERATOR from user management (403 FORBIDDEN)', async () => {
    const operator = await dbStore.users.findOne({ email: 'operator@electiondesk.gov' });
    const mw = requireRole(UserRole.SUPER_ADMIN);

    const req = { user: operator, ip: '127.0.0.1', headers: {}, originalUrl: '/api/v1/users' };
    let calledNext = false;
    let statusCode = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { return this; },
    };

    await mw(req, res, () => { calledNext = true; });
    expect(calledNext).toBe(false);
    expect(statusCode).toBe(403);
  });

  it('requires step-up token for sensitive export actions (403 STEP_UP_REQUIRED)', () => {
    const dataAdmin = { _id: '12345', role: UserRole.DATA_ADMIN };
    const req = { user: dataAdmin, headers: {} };
    let calledNext = false;
    let statusCode = null;
    let responseBody = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseBody = data; return this; },
    };

    requireStepUpAuth(req, res, () => { calledNext = true; });
    expect(calledNext).toBe(false);
    expect(statusCode).toBe(403);
    expect(responseBody.error.code).toBe('STEP_UP_REQUIRED');
  });

  it('grants access when valid step-up token is provided', async () => {
    const dataAdmin = await dbStore.users.findOne({ email: 'dataadmin@electiondesk.gov' });
    const { stepUpToken } = await generateStepUpToken({
      userId: dataAdmin._id || dataAdmin.id,
      password: 'DataAdmin@2026!',
      ipAddress: '127.0.0.1',
    });

    const req = {
      user: dataAdmin,
      headers: { 'x-step-up-token': stepUpToken },
    };
    let calledNext = false;
    const res = {
      status(code) { return this; },
      json(data) { return this; },
    };

    requireStepUpAuth(req, res, () => { calledNext = true; });
    expect(calledNext).toBe(true);
  });

  it('proves cryptographic audit log chain integrity and detects tampering', async () => {
    // 1. Log a few actions
    const admin = await dbStore.users.findOne({ email: 'superadmin@electiondesk.gov' });
    await logAuditEvent({
      actor: admin,
      action: 'RECORD_CREATE',
      entityType: 'VOTER',
      entityId: 'VOTER_101',
    });
    await logAuditEvent({
      actor: admin,
      action: 'RECORD_UPDATE',
      entityType: 'VOTER',
      entityId: 'VOTER_101',
    });

    // 2. Verify chain is valid
    const initialCheck = await verifyAuditChainIntegrity();
    expect(initialCheck.valid).toBe(true);
    expect(initialCheck.brokenAt).toBeNull();

    // 3. Simulate an adversary tampering with an audit record in the chain
    const { logs } = await dbStore.auditLogs.query({ filter: {}, limit: 10 });
    if (logs.length > 1) {
      // Alter previousHash to break chain
      logs[0].previousHash = 'CORRUPTED_HASH_ATTACKER_ALTERATION_000000000000000000';
      const tamperCheck = await verifyAuditChainIntegrity();
      expect(tamperCheck.valid).toBe(false);
      expect(tamperCheck.brokenAt).toBeDefined();
    }
  });
});
