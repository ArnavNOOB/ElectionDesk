import { getDashboardOverviewMetrics } from '../services/reportService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export async function handleGetDashboardMetrics(req, res, next) {
  try {
    const metrics = await getDashboardOverviewMetrics();
    return ApiResponse.success(res, metrics, 'Dashboard statistics calculated');
  } catch (error) {
    next(error);
  }
}
