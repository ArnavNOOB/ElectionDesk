import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const mfaVerifySchema = z.object({
  tempToken: z.string().min(10, 'Invalid or missing MFA challenge token'),
  tokenOrBackupCode: z.string().min(4, 'Please enter your 6-digit TOTP code or backup code'),
});

export const stepUpSchema = z.object({
  password: z.string().min(1, 'Password is required for elevation authorization'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(12, 'New password must be at least 12 characters long')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/[a-z]/, 'Must include a lowercase letter')
    .regex(/[0-9]/, 'Must include a number')
    .regex(/[^A-Za-z0-9]/, 'Must include a special character'),
});
