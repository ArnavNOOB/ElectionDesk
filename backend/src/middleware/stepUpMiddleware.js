import { ApiResponse } from '../utils/apiResponse.js';
import { verifyStepUpToken } from '../services/authService.js';

export function requireStepUpAuth(req, res, next) {
  const stepUpHeader = req.headers['x-step-up-token'];

  if (!stepUpHeader) {
    return ApiResponse.error(
      res,
      'Step-up authentication required for this sensitive action. Please re-enter your password.',
      403,
      'STEP_UP_REQUIRED'
    );
  }

  const decoded = verifyStepUpToken(stepUpHeader);
  if (!decoded) {
    return ApiResponse.error(
      res,
      'Invalid or expired step-up authorization token. Please authenticate again.',
      403,
      'INVALID_STEP_UP_TOKEN'
    );
  }

  const currentUserId = String(req.user?._id || req.user?.id);
  if (String(decoded.userId) !== currentUserId) {
    return ApiResponse.error(res, 'Step-up token mismatch.', 403, 'STEP_UP_MISMATCH');
  }

  next();
}
