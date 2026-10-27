import { describe, it, expect, beforeEach } from 'vitest';
import { dbStore } from '../src/services/store.js';
import { seedDatabase } from './helpers/testFixtures.js';
import { login, setupMfa, verifyMfaChallenge, generateStepUpToken, verifyStepUpToken } from '../src/services/authService.js';
import { hashPassword, verifyPassword } from '../src/utils/crypto.js';

describe('Authentication & Identity Security Tests (Argon2id, MFA, Lockout)', () => {
  beforeEach(async () => {
    dbStore.clearMemoryStore();
    await seedDatabase();
  });

  it('authenticates valid credentials and returns JWT token and sanitized user profile', async () => {
    const result = await login({
      email: 'superadmin@electiondesk.gov',
      password: 'SuperAdmin@2026!',
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest Unit Agent',
    });

    expect(result.token).toBeDefined();
    expect(result.user.email).toBe('superadmin@electiondesk.gov');
    expect(result.user.role).toBe('SUPER_ADMIN');
    expect(result.user.passwordHash).toBeUndefined(); // Never expose password hash
  });

  it('rejects invalid password and increments failed login counter', async () => {
    await expect(
      login({
        email: 'superadmin@electiondesk.gov',
        password: 'WrongPassword123!',
        ipAddress: '127.0.0.1',
        userAgent: 'Vitest Unit Agent',
      })
    ).rejects.toThrow('Invalid email or password');

    const user = await dbStore.users.findOne({ email: 'superadmin@electiondesk.gov' });
    expect(user.failedLoginAttempts).toBe(1);
  });

  it('enforces progressive account lockout after 5 consecutive failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      try {
        await login({
          email: 'operator@electiondesk.gov',
          password: 'BadPassword!',
          ipAddress: '127.0.0.1',
        });
      } catch (err) {
        // Expected failure
      }
    }

    const lockedUser = await dbStore.users.findOne({ email: 'operator@electiondesk.gov' });
    expect(lockedUser.failedLoginAttempts).toBe(5);
    expect(lockedUser.lockUntil).not.toBeNull();

    // 6th attempt must be rejected with lockout notification
    await expect(
      login({
        email: 'operator@electiondesk.gov',
        password: 'Operator@2026!',
        ipAddress: '127.0.0.1',
      })
    ).rejects.toThrow(/Account is temporarily locked/);
  });

  it('verifies Argon2id password hashing strength and verification', async () => {
    const plain = 'StrongSecurePassword@2026!';
    const hash = await hashPassword(plain);

    expect(hash).toContain('$argon2id$');
    const isValid = await verifyPassword(hash, plain);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword(hash, 'WrongPassword');
    expect(isInvalid).toBe(false);
  });

  it('enrolls TOTP MFA with QR code data URL and 6 backup codes', async () => {
    const user = await dbStore.users.findOne({ email: 'superadmin@electiondesk.gov' });
    const mfaSetup = await setupMfa(user._id || user.id);

    expect(mfaSetup.secret).toBeDefined();
    expect(mfaSetup.qrCodeDataUrl).toContain('data:image/png;base64');
    expect(mfaSetup.backupCodes.length).toBe(6);

    // Verify backup code challenge authentication
    const backupCode = mfaSetup.backupCodes[0];
    const challengeRes = await login({
      email: 'superadmin@electiondesk.gov',
      password: 'SuperAdmin@2026!',
    });

    // When MFA enabled
    await dbStore.users.updateOne({ _id: user._id || user.id }, { $set: { mfaEnabled: true } });
    const mfaLogin = await login({
      email: 'superadmin@electiondesk.gov',
      password: 'SuperAdmin@2026!',
    });
    expect(mfaLogin.mfaRequired).toBe(true);
    expect(mfaLogin.tempToken).toBeDefined();

    // Verify using backup code
    const verifyRes = await verifyMfaChallenge({
      tempToken: mfaLogin.tempToken,
      tokenOrBackupCode: backupCode,
      ipAddress: '127.0.0.1',
    });

    expect(verifyRes.token).toBeDefined();
    expect(verifyRes.user.mfaEnabled).toBe(true);
  });

  it('generates and validates short-lived step-up authorization token', async () => {
    const user = await dbStore.users.findOne({ email: 'dataadmin@electiondesk.gov' });
    const { stepUpToken } = await generateStepUpToken({
      userId: user._id || user.id,
      password: 'DataAdmin@2026!',
      ipAddress: '127.0.0.1',
    });

    expect(stepUpToken).toBeDefined();
    const verified = verifyStepUpToken(stepUpToken);
    expect(verified.userId).toBe(user._id || user.id);
    expect(verified.stepUp).toBe(true);
  });
});
