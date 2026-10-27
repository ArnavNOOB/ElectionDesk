import { dbStore } from '../services/store.js';
import { isDbInMemory, isDbConnected } from '../config/db.js';
import { ApiResponse } from '../utils/apiResponse.js';

export async function handleGetSecurityHealth(req, res, next) {
  try {
    const memoryUsage = process.memoryUsage();
    const activeAlerts = await dbStore.securityEvents.query({ filter: { resolved: false }, limit: 20 });
    const resolvedAlerts = await dbStore.securityEvents.query({ filter: { resolved: true }, limit: 20 });

    const healthData = {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        connected: isDbConnected(),
        mode: isDbInMemory() ? 'IN_MEMORY_FALLBACK' : 'MONGODB_CLUSTER',
      },
      memory: {
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      },
      security: {
        unresolvedAlertCount: activeAlerts.length,
        activeAlerts,
        resolvedAlerts,
      },
    };

    return ApiResponse.success(res, healthData, 'Security health status retrieved');
  } catch (error) {
    next(error);
  }
}

export async function handleResolveSecurityEvent(req, res, next) {
  try {
    const { id } = req.params;
    await dbStore.securityEvents.updateOne(
      { _id: id },
      {
        $set: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: req.user._id || req.user.id,
        },
      }
    );
    return ApiResponse.success(res, null, 'Security event marked as resolved');
  } catch (error) {
    next(error);
  }
}
