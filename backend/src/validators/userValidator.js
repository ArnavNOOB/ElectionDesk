import { z } from 'zod';
import { UserRole } from '../models/User.js';

export const createUserSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  fullName: z.string().min(2, 'Full Name is required'),
  role: z.nativeEnum(UserRole),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/[a-z]/, 'Must include a lowercase letter')
    .regex(/[0-9]/, 'Must include a number'),
  assignedConstituencies: z.array(z.string()).optional().default([]),
});

export const updateRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export const toggleUserStatusSchema = z.object({
  isActive: z.boolean(),
});
