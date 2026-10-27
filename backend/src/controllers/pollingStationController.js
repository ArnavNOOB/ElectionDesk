import {
  listPollingStations,
  getPollingStationById,
  createPollingStation,
  updatePollingStation,
  getBoothSummaryMetrics,
} from '../services/pollingStationService.js';
import { boothSchema } from '../validators/boothValidator.js';
import { ApiResponse } from '../utils/apiResponse.js';

export async function handleListPollingStations(req, res, next) {
  try {
    const { search = '', assemblyConstituency, status } = req.query;
    const booths = await listPollingStations({ search, assemblyConstituency, status });
    return ApiResponse.success(res, booths, 'Polling stations retrieved');
  } catch (error) {
    next(error);
  }
}

export async function handleGetPollingStation(req, res, next) {
  try {
    const booth = await getPollingStationById(req.params.id);
    if (!booth) {
      return ApiResponse.error(res, 'Polling station not found', 404, 'NOT_FOUND');
    }
    return ApiResponse.success(res, booth, 'Polling station retrieved');
  } catch (error) {
    next(error);
  }
}

export async function handleCreatePollingStation(req, res, next) {
  try {
    const validated = boothSchema.parse(req.body);
    const booth = await createPollingStation(validated, req.user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return ApiResponse.success(res, booth, 'Polling station created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function handleUpdatePollingStation(req, res, next) {
  try {
    const validated = boothSchema.partial().parse(req.body);
    const updated = await updatePollingStation(req.params.id, validated, req.user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return ApiResponse.success(res, updated, 'Polling station updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function handleGetBoothSummary(req, res, next) {
  try {
    const metrics = await getBoothSummaryMetrics();
    return ApiResponse.success(res, metrics, 'Booth metrics retrieved');
  } catch (error) {
    next(error);
  }
}
