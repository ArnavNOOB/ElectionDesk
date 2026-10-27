#!/usr/bin/env node

/**
 * ElectionDesk - Production Administrator Provisioning Utility
 * 
 * Securely provisions a custom SUPER_ADMIN account in MongoDB Atlas or local MongoDB.
 * Reuses existing Mongoose UserModel and Argon2id cryptographic hashing.
 * 
 * Features:
 *  - Interactive terminal prompt OR environment variables (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME)
 *  - Password complexity validation (OWASP ASVS Baseline: >= 10 chars, upper, lower, digit)
 *  - Idempotent: Checks for existing accounts; never overwrites or silently promotes
 *  - Zero secret leakage: Never logs plain passwords
 *  - Works seamlessly with MongoDB Atlas via MONGODB_URI
 */

import readline from 'readline';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { UserModel, UserRole } from '../src/models/User.js';
import { hashPassword } from '../src/utils/crypto.js';
import { logger } from '../src/utils/logger.js';
import { connectDB, disconnectDB, isDbInMemory } from '../src/config/db.js';

// Interactive prompt helper
function promptQuestion(rl, query, isPassword = false) {
  return new Promise((resolve) => {
    if (!isPassword) {
      rl.question(query, (answer) => resolve(answer.trim()));
      return;
    }

    // Masked password prompt for TTY
    process.stdout.write(query);
    let password = '';
    const stdin = process.stdin;
    const isRaw = stdin.isRaw;
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }
    stdin.resume();

    const onData = (chunk) => {
      const char = chunk.toString();
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.removeListener('data', onData);
        if (stdin.setRawMode) stdin.setRawMode(isRaw);
        process.stdout.write('\n');
        resolve(password.trim());
      } else if (char === '\u0003') {
        // Ctrl+C
        process.stdout.write('\n');
        process.exit(1);
      } else if (char === '\b' || char === '\x7f') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += char;
        process.stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 10) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

export async function createAdminAccount(options = {}) {
  let email = (options.email || process.env.ADMIN_EMAIL || '').trim();
  let password = (options.password || process.env.ADMIN_PASSWORD || '').trim();
  let fullName = (options.fullName || process.env.ADMIN_NAME || 'System Administrator').trim();

  // If credentials are not supplied via env or options, prompt interactively if TTY
  if (!email || !password) {
    if (process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log('\n======================================================');
      console.log('ElectionDesk - Administrator Provisioning Console');
      console.log('======================================================\n');

      if (!email) {
        email = await promptQuestion(rl, 'Enter Admin Email: ');
      }
      if (!fullName || fullName === 'System Administrator') {
        const inputName = await promptQuestion(rl, 'Enter Full Name (Default: "System Administrator"): ');
        if (inputName) fullName = inputName;
      }
      if (!password) {
        password = await promptQuestion(rl, 'Enter Admin Password (min 10 chars, uppercase, lowercase, digit): ', true);
        const confirmPassword = await promptQuestion(rl, 'Confirm Admin Password: ', true);
        if (password !== confirmPassword) {
          rl.close();
          console.error('\n[ERROR] Passwords do not match. Aborting.\n');
          process.exit(1);
        }
      }

      rl.close();
    } else {
      console.error('\n[ERROR] Missing credentials for administrator provisioning.');
      console.error('Please provide ADMIN_EMAIL and ADMIN_PASSWORD as environment variables:');
      console.error('  $env:ADMIN_EMAIL="admin@yourdomain.com"');
      console.error('  $env:ADMIN_PASSWORD="YourSecurePassword123!"');
      console.error('  npm run create:admin\n');
      process.exit(1);
    }
  }

  // 1. Validate inputs
  const normalizedEmail = email.toLowerCase().trim();
  if (!validateEmail(normalizedEmail)) {
    console.error(`\n[ERROR] Invalid email format: "${email}". Must be a valid email address.\n`);
    process.exit(1);
  }

  if (!validatePassword(password)) {
    console.error('\n[ERROR] Password does not meet security requirements:');
    console.error('  - Minimum 10 characters');
    console.error('  - At least 1 uppercase letter (A-Z)');
    console.error('  - At least 1 lowercase letter (a-z)');
    console.error('  - At least 1 numeric digit (0-9)\n');
    process.exit(1);
  }

  // 2. Connect to Database (real MongoDB Atlas or configured DB)
  await connectDB();

  try {
    // 3. Guard against duplicate or existing accounts
    let existingUser = null;
    if (!isDbInMemory()) {
      existingUser = await UserModel.findOne({ email: normalizedEmail });
    } else {
      const { dbStore } = await import('../src/services/store.js');
      existingUser = await dbStore.users.findOne({ email: normalizedEmail });
    }

    if (existingUser) {
      console.log('\n------------------------------------------------------');
      console.log(`[NOTICE] Account already exists for email: ${normalizedEmail}`);
      console.log(`Current Role: ${existingUser.role}`);
      console.log(`Account Status: ${existingUser.isActive ? 'Active' : 'Inactive'}`);
      console.log('Action: No modifications made. Existing credentials preserved.');
      console.log('------------------------------------------------------\n');
      return { success: false, existing: true, email: normalizedEmail };
    }

    // 4. Hash password with OWASP Argon2id
    const passwordHash = await hashPassword(password);

    // 5. Create new Super Administrator record
    const adminData = {
      email: normalizedEmail,
      passwordHash,
      fullName: fullName || 'System Administrator',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: [],
      failedLoginAttempts: 0,
      sessionVersion: 1,
      assignedConstituencies: [],
    };

    let createdUser;
    if (!isDbInMemory()) {
      createdUser = await UserModel.create(adminData);
    } else {
      const { dbStore } = await import('../src/services/store.js');
      createdUser = await dbStore.users.create(adminData);
    }

    console.log('\n======================================================');
    console.log('Super Administrator provisioned successfully!');
    console.log('======================================================');
    console.log(`Email:     ${createdUser.email}`);
    console.log(`Full Name: ${createdUser.fullName}`);
    console.log(`Role:      ${createdUser.role}`);
    console.log(`Status:    ${createdUser.isActive ? 'Active' : 'Inactive'}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('======================================================\n');

    return { success: true, existing: false, email: normalizedEmail, role: createdUser.role };
  } finally {
    await disconnectDB();
  }
}

// Direct execution entrypoint
if (process.argv[1]?.endsWith('createAdmin.js')) {
  createAdminAccount()
    .then((result) => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n[FATAL] Administrator provisioning failed:', err.message);
      process.exit(1);
    });
}
