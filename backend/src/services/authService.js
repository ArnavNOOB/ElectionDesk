import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { dbStore } from './store.js';
import { env } from '../config/env.js';
import { hashPassword, verifyPassword, calculateSha256, generateRandomToken } from '../utils/crypto.js';
import { logAuditEvent } from './auditService.js';
import { logger } from '../utils/logger.js';

const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 mins

export async function login({ email, password, ipAddress, userAgent }) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const user = await dbStore.users.findOne({ email: normalizedEmail });

  if (!user) {
    await logAuditEvent({
      action: 'LOGIN',
      entityType: 'USER',
      outcome: 'FAILURE',
      ipAddress,
      userAgent,
      details: { email: normalizedEmail, reason: 'User not found' },
    });
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    await logAuditEvent({
      actor: user,
      action: 'LOGIN',
      entityType: 'USER',
      outcome: 'DENIED',
      ipAddress,
      userAgent,
      details: { reason: 'Account suspended' },
    });
    throw new Error('Account is suspended. Please contact the Super Administrator.');
  }

  // Check account lockout
  if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.lockUntil) - new Date()) / 60000);
    await logAuditEvent({
      actor: user,
      action: 'LOGIN',
      entityType: 'USER',
      outcome: 'DENIED',
      ipAddress,
      userAgent,
      details: { reason: 'Account temporarily locked', minutesLeft },
    });
    throw new Error(`Account is temporarily locked. Try again in ${minutesLeft} minutes.`);
  }

  const isPasswordValid = await verifyPassword(user.passwordHash, password);
  if (!isPasswordValid) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    let lockUntil = null;
    if (attempts >= LOCKOUT_ATTEMPTS) {
      lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      await dbStore.securityEvents.create({
        eventType: 'ACCOUNT_LOCKOUT',
        severity: 'HIGH',
        sourceIp: ipAddress,
        details: { email: user.email, attempts },
      });
    }

    await dbStore.users.updateOne(
      { _id: user._id || user.id },
      { $set: { failedLoginAttempts: attempts, lockUntil } }
    );

    await logAuditEvent({
      actor: user,
      action: 'LOGIN',
      entityType: 'USER',
      outcome: 'FAILURE',
      ipAddress,
      userAgent,
      details: { failedAttempts: attempts, locked: !!lockUntil },
    });

    throw new Error('Invalid email or password');
  }

  // Password valid: reset failures
  await dbStore.users.updateOne(
    { _id: user._id || user.id },
    { $set: { failedLoginAttempts: 0, lockUntil: null, lastLoginAt: new Date() } }
  );

  // If MFA is enabled, issue a temporary 5-minute MFA challenge token
  if (user.mfaEnabled) {
    const tempToken = jwt.sign(
      {
        userId: user._id || user.id,
        mfaPending: true,
        sessionVersion: user.sessionVersion,
      },
      env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    return {
      mfaRequired: true,
      tempToken,
      user: {
        id: user._id || user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  // Issue full session token
  const token = jwt.sign(
    {
      userId: user._id || user.id,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  await logAuditEvent({
    actor: user,
    action: 'LOGIN',
    entityType: 'USER',
    entityId: user._id || user.id,
    outcome: 'SUCCESS',
    ipAddress,
    userAgent,
    details: { mfaUsed: false },
  });

  return {
    mfaRequired: false,
    token,
    user: {
      id: user._id || user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
    },
  };
}

export async function setupMfa(userId) {
  const user = await dbStore.users.findById(userId);
  if (!user) throw new Error('User not found');

  const secret = speakeasy.generateSecret({
    name: `ElectionDesk (${user.email})`,
    issuer: 'ElectionDesk ECI',
  });

  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  // Generate 6 backup recovery codes
  const plainBackupCodes = [];
  const hashedBackupCodes = [];
  for (let i = 0; i < 6; i++) {
    const code = generateRandomToken(4).toUpperCase(); // e.g. A1B2C3D4
    plainBackupCodes.push(code);
    hashedBackupCodes.push(calculateSha256(code));
  }

  // Store temporarily on user until confirmed
  await dbStore.users.updateOne(
    { _id: user._id || user.id },
    { $set: { mfaSecret: secret.base32, mfaBackupCodes: hashedBackupCodes } }
  );

  return {
    secret: secret.base32,
    qrCodeDataUrl,
    backupCodes: plainBackupCodes,
  };
}

export async function verifyMfaChallenge({ tempToken, tokenOrBackupCode, ipAddress, userAgent }) {
  let decoded;
  try {
    decoded = jwt.verify(tempToken, env.JWT_SECRET);
  } catch (err) {
    throw new Error('MFA challenge session expired. Please log in again.');
  }

  if (!decoded.userId || !decoded.mfaPending) {
    throw new Error('Invalid MFA token payload');
  }

  const user = await dbStore.users.findById(decoded.userId);
  if (!user || !user.isActive) {
    throw new Error('User not found or account inactive');
  }

  if (user.sessionVersion !== decoded.sessionVersion) {
    throw new Error('Session revoked. Please log in again.');
  }

  // Check TOTP code
  let isTotpValid = false;
  if (user.mfaSecret) {
    isTotpValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: tokenOrBackupCode.replace(/\s+/g, ''),
      window: 1, // +/- 30 seconds
    });
  }

  // If not valid TOTP, check if it is a backup code
  let usedBackupCode = false;
  if (!isTotpValid && Array.isArray(user.mfaBackupCodes) && user.mfaBackupCodes.length > 0) {
    const inputHash = calculateSha256(tokenOrBackupCode.trim().toUpperCase());
    const codeIndex = user.mfaBackupCodes.indexOf(inputHash);
    if (codeIndex !== -1) {
      usedBackupCode = true;
      isTotpValid = true;
      // Burn the used backup code
      const updatedCodes = [...user.mfaBackupCodes];
      updatedCodes.splice(codeIndex, 1);
      await dbStore.users.updateOne(
        { _id: user._id || user.id },
        { $set: { mfaBackupCodes: updatedCodes } }
      );
    }
  }

  if (!isTotpValid) {
    await logAuditEvent({
      actor: user,
      action: 'MFA_VERIFY',
      entityType: 'USER',
      entityId: user._id || user.id,
      outcome: 'FAILURE',
      ipAddress,
      userAgent,
      details: { reason: 'Invalid MFA verification code' },
    });
    throw new Error('Invalid MFA verification code or backup code');
  }

  // Ensure mfaEnabled is set
  await dbStore.users.updateOne(
    { _id: user._id || user.id },
    { $set: { mfaEnabled: true, lastLoginAt: new Date() } }
  );

  const fullToken = jwt.sign(
    {
      userId: user._id || user.id,
      email: user.email,
      role: user.role,
      sessionVersion: user.sessionVersion,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  await logAuditEvent({
    actor: user,
    action: 'MFA_VERIFY',
    entityType: 'USER',
    entityId: user._id || user.id,
    outcome: 'SUCCESS',
    ipAddress,
    userAgent,
    details: { usedBackupCode },
  });

  return {
    token: fullToken,
    user: {
      id: user._id || user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      mfaEnabled: true,
    },
  };
}

export async function generateStepUpToken({ userId, password, ipAddress, userAgent }) {
  const user = await dbStore.users.findById(userId);
  if (!user) throw new Error('User not found');

  const isPasswordValid = await verifyPassword(user.passwordHash, password);
  if (!isPasswordValid) {
    await logAuditEvent({
      actor: user,
      action: 'STEP_UP_AUTH',
      entityType: 'USER',
      outcome: 'FAILURE',
      ipAddress,
      userAgent,
      details: { reason: 'Invalid password for step-up elevation' },
    });
    throw new Error('Invalid password for privileged action authorization');
  }

  const stepUpToken = jwt.sign(
    {
      userId: user._id || user.id,
      stepUp: true,
      timestamp: Date.now(),
    },
    env.STEP_UP_JWT_SECRET,
    { expiresIn: '10m' } // 10 minutes window for privileged operations
  );

  await logAuditEvent({
    actor: user,
    action: 'STEP_UP_AUTH',
    entityType: 'USER',
    entityId: user._id || user.id,
    outcome: 'SUCCESS',
    ipAddress,
    userAgent,
    details: { purpose: 'Privileged Operation Authorization' },
  });

  return { stepUpToken };
}

export function verifyStepUpToken(token) {
  try {
    const decoded = jwt.verify(token, env.STEP_UP_JWT_SECRET);
    if (!decoded.stepUp) return null;
    return decoded;
  } catch (err) {
    return null;
  }
}
