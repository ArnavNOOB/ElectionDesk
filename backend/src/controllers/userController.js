import { dbStore } from '../services/store.js';
import { hashPassword } from '../utils/crypto.js';
import { logAuditEvent } from '../services/auditService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { createUserSchema, updateRoleSchema, toggleUserStatusSchema } from '../validators/userValidator.js';

export async function handleListUsers(req, res, next) {
  try {
    const users = await dbStore.users.find();
    return ApiResponse.success(res, users, 'Users retrieved');
  } catch (error) {
    next(error);
  }
}

export async function handleCreateUser(req, res, next) {
  try {
    const validated = createUserSchema.parse(req.body);
    const existing = await dbStore.users.findOne({ email: validated.email.toLowerCase().trim() });
    if (existing) {
      return ApiResponse.error(res, 'A user with this email address already exists', 400, 'USER_EXISTS');
    }

    const passwordHash = await hashPassword(validated.password);
    const newUser = await dbStore.users.create({
      email: validated.email.toLowerCase().trim(),
      fullName: validated.fullName.trim(),
      role: validated.role,
      passwordHash,
      assignedConstituencies: validated.assignedConstituencies || [],
    });

    await logAuditEvent({
      actor: req.user,
      action: 'USER_CREATE',
      entityType: 'USER',
      entityId: newUser._id || newUser.id,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      details: { email: newUser.email, role: newUser.role },
    });

    const { passwordHash: _, ...safeUser } = newUser;
    return ApiResponse.success(res, safeUser, 'User account created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateUserRole(req, res, next) {
  try {
    const validated = updateRoleSchema.parse(req.body);
    const targetUser = await dbStore.users.findById(req.params.id);
    if (!targetUser) return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');

    const previousRole = targetUser.role;
    await dbStore.users.updateOne(
      { _id: req.params.id },
      { $set: { role: validated.role, sessionVersion: (targetUser.sessionVersion || 1) + 1 } }
    );

    await logAuditEvent({
      actor: req.user,
      action: 'ROLE_CHANGE',
      entityType: 'USER',
      entityId: req.params.id,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      details: { previousRole, newRole: validated.role },
    });

    return ApiResponse.success(res, null, `User role changed from ${previousRole} to ${validated.role}`);
  } catch (error) {
    next(error);
  }
}

export async function handleToggleUserStatus(req, res, next) {
  try {
    const validated = toggleUserStatusSchema.parse(req.body);
    const targetUser = await dbStore.users.findById(req.params.id);
    if (!targetUser) return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');

    // Prevent deactivating own account
    if (String(req.user._id || req.user.id) === String(targetUser._id || targetUser.id)) {
      return ApiResponse.error(res, 'You cannot deactivate your own account', 400, 'SELF_DEACTIVATION');
    }

    await dbStore.users.updateOne(
      { _id: req.params.id },
      { $set: { isActive: validated.isActive, sessionVersion: (targetUser.sessionVersion || 1) + 1 } }
    );

    await logAuditEvent({
      actor: req.user,
      action: validated.isActive ? 'USER_ACTIVATE' : 'USER_SUSPEND',
      entityType: 'USER',
      entityId: req.params.id,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      details: { email: targetUser.email, newStatus: validated.isActive ? 'Active' : 'Suspended' },
    });

    return ApiResponse.success(
      res,
      null,
      `User account ${validated.isActive ? 'activated' : 'suspended'} successfully`
    );
  } catch (error) {
    next(error);
  }
}

export async function handleResetUserMfa(req, res, next) {
  try {
    const targetUser = await dbStore.users.findById(req.params.id);
    if (!targetUser) return ApiResponse.error(res, 'User not found', 404, 'NOT_FOUND');

    await dbStore.users.updateOne(
      { _id: req.params.id },
      { $set: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] } }
    );

    await logAuditEvent({
      actor: req.user,
      action: 'MFA_RESET',
      entityType: 'USER',
      entityId: req.params.id,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      details: { email: targetUser.email },
    });

    return ApiResponse.success(res, null, 'User MFA reset. User will be prompted to re-enroll on next login.');
  } catch (error) {
    next(error);
  }
}
