import { describe, it, expect, beforeEach } from 'vitest';
import { dbStore } from '../src/services/store.js';
import { createAdminAccount } from '../scripts/createAdmin.js';
import { verifyPassword } from '../src/utils/crypto.js';
import { UserRole } from '../src/models/User.js';

describe('Admin Provisioning Script (createAdmin.js) Tests', () => {
  beforeEach(() => {
    dbStore.clearMemoryStore();
  });

  it('successfully provisions a new SUPER_ADMIN account with Argon2id password hash', async () => {
    const result = await createAdminAccount({
      email: 'myadmin@electiondesk.gov',
      password: 'SecureAdminPassword123!',
      fullName: 'Chief Electoral Officer',
    });

    expect(result.success).toBe(true);
    expect(result.existing).toBe(false);
    expect(result.email).toBe('myadmin@electiondesk.gov');
    expect(result.role).toBe(UserRole.SUPER_ADMIN);

    const user = await dbStore.users.findOne({ email: 'myadmin@electiondesk.gov' });
    expect(user).toBeDefined();
    expect(user.fullName).toBe('Chief Electoral Officer');
    expect(user.role).toBe(UserRole.SUPER_ADMIN);
    expect(user.isActive).toBe(true);

    const isPasswordValid = await verifyPassword(user.passwordHash, 'SecureAdminPassword123!');
    expect(isPasswordValid).toBe(true);
  });

  it('guarantees idempotency and rejects overwriting existing accounts', async () => {
    // First creation
    await createAdminAccount({
      email: 'persistent@electiondesk.gov',
      password: 'OriginalPassword123!',
      fullName: 'Original Admin',
    });

    const userBefore = await dbStore.users.findOne({ email: 'persistent@electiondesk.gov' });
    const originalHash = userBefore.passwordHash;

    // Second execution with different password and name
    const secondResult = await createAdminAccount({
      email: 'persistent@electiondesk.gov',
      password: 'AttemptedNewPassword123!',
      fullName: 'Imposter Admin',
    });

    expect(secondResult.success).toBe(false);
    expect(secondResult.existing).toBe(true);

    // Verify existing record is 100% untouched
    const userAfter = await dbStore.users.findOne({ email: 'persistent@electiondesk.gov' });
    expect(userAfter.passwordHash).toBe(originalHash);
    expect(userAfter.fullName).toBe('Original Admin');

    const originalPasswordStillWorks = await verifyPassword(userAfter.passwordHash, 'OriginalPassword123!');
    expect(originalPasswordStillWorks).toBe(true);

    const imposterPasswordFails = await verifyPassword(userAfter.passwordHash, 'AttemptedNewPassword123!');
    expect(imposterPasswordFails).toBe(false);
  });
});
