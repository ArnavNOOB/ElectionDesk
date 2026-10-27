import argon2 from 'argon2';
import crypto from 'crypto';

/**
 * Hash password using Argon2id with OWASP recommended configuration:
 * Memory cost: 64MB (65536 KB), Time cost (iterations): 3, Parallelism: 4 threads
 */
export async function hashPassword(plainPassword) {
  return argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify plain password against Argon2id hash
 */
export async function verifyPassword(hash, plainPassword) {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch (err) {
    return false;
  }
}

/**
 * Calculate SHA-256 hash of a string or buffer
 */
export function calculateSha256(data) {
  const content = typeof data === 'string' ? data : Buffer.from(data);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generate secure random hex string
 */
export function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate cryptographically secure numeric OTP (e.g. 6 digits)
 */
export function generateNumericOtp(length = 6) {
  const digits = '0123456789';
  let otp = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[randomBytes[i] % 10];
  }
  return otp;
}
