import { login, setupMfa, verifyMfaChallenge, generateStepUpToken } from '../services/authService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { loginSchema, mfaVerifySchema, stepUpSchema } from '../validators/authValidator.js';
import { logAuditEvent } from '../services/auditService.js';
import { dbStore } from '../services/store.js';

export async function handleLogin(req, res, next) {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await login({
      email: validated.email,
      password: validated.password,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || '',
    });

    if (result.token) {
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('session_token', result.token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
      });
    }

    return ApiResponse.success(res, result, 'Authentication successful');
  } catch (error) {
    next(error);
  }
}

export async function handleMfaVerify(req, res, next) {
  try {
    const validated = mfaVerifySchema.parse(req.body);
    const result = await verifyMfaChallenge({
      tempToken: validated.tempToken,
      tokenOrBackupCode: validated.tokenOrBackupCode,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || '',
    });

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('session_token', result.token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });

    return ApiResponse.success(res, result, 'MFA challenge verified successfully');
  } catch (error) {
    next(error);
  }
}

export async function handleSetupMfa(req, res, next) {
  try {
    const result = await setupMfa(req.user._id || req.user.id);
    return ApiResponse.success(res, result, 'MFA secret generated');
  } catch (error) {
    next(error);
  }
}

export async function handleStepUpAuth(req, res, next) {
  try {
    const validated = stepUpSchema.parse(req.body);
    const result = await generateStepUpToken({
      userId: req.user._id || req.user.id,
      password: validated.password,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || '',
    });
    return ApiResponse.success(res, result, 'Step-up authorization granted');
  } catch (error) {
    next(error);
  }
}

export async function handleGetCurrentUser(req, res) {
  const { passwordHash, mfaSecret, ...safeUser } = req.user;
  return ApiResponse.success(res, safeUser, 'User profile retrieved');
}

export async function handleLogout(req, res) {
  res.clearCookie('session_token');

  if (req.user) {
    await logAuditEvent({
      actor: req.user,
      action: 'LOGOUT',
      entityType: 'USER',
      entityId: req.user._id || req.user.id,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      details: { email: req.user.email },
    });
  }

  return ApiResponse.success(res, null, 'Logged out successfully');
}
