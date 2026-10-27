import {
  listVoters,
  getVoterById,
  createVoter,
  updateVoter,
  archiveVoter,
  restoreVoter,
  detectPotentialDuplicates,
  listFamilyHeads,
} from '../services/voterService.js';
import { createVoterSchema, updateVoterSchema } from '../validators/voterValidator.js';
import { ApiResponse } from '../utils/apiResponse.js';

export async function handleListVoters(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      locality = '',
      electoralArea,
      pollingStationId,
      verificationStatus,
      familyRole,
      familyHeadId,
      hasPhoto,
      dataQualityIssue,
      isArchived = false,
      sortField = 'boothSerialNumber',
      sortOrder = 'asc',
    } = req.query;

    const data = await listVoters({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      search,
      locality,
      electoralArea,
      pollingStationId,
      verificationStatus,
      familyRole,
      familyHeadId,
      hasPhoto,
      dataQualityIssue,
      isArchived: isArchived === 'true',
      sortField,
      sortOrder,
    });

    return ApiResponse.success(res, data.records, 'Voters retrieved', 200, data.pagination);
  } catch (error) {
    next(error);
  }
}

export async function handleListFamilyHeads(req, res, next) {
  try {
    const { pollingStationId } = req.query;
    const heads = await listFamilyHeads({ pollingStationId });
    return ApiResponse.success(res, heads, 'Family heads retrieved');
  } catch (error) {
    next(error);
  }
}

export async function handleGetVoter(req, res, next) {
  try {
    const voter = await getVoterById(req.params.id);
    if (!voter) {
      return ApiResponse.error(res, 'Voter record not found', 404, 'NOT_FOUND');
    }
    return ApiResponse.success(res, voter, 'Voter record retrieved');
  } catch (error) {
    next(error);
  }
}

export async function handleCreateVoter(req, res, next) {
  try {
    const validated = createVoterSchema.parse(req.body);
    const newVoter = await createVoter(validated, req.user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return ApiResponse.success(res, newVoter, 'Voter record created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateVoter(req, res, next) {
  try {
    const validated = updateVoterSchema.parse(req.body);
    const updated = await updateVoter(req.params.id, validated, req.user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return ApiResponse.success(res, updated, 'Voter record updated successfully');
  } catch (error) {
    next(error);
  }
}

export async function handleArchiveVoter(req, res, next) {
  try {
    const { reason } = req.body;
    const result = await archiveVoter(req.params.id, reason, req.user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return ApiResponse.success(res, result, 'Voter record archived successfully');
  } catch (error) {
    next(error);
  }
}

export async function handleRestoreVoter(req, res, next) {
  try {
    const result = await restoreVoter(req.params.id, req.user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return ApiResponse.success(res, result, 'Voter record restored successfully');
  } catch (error) {
    next(error);
  }
}

export async function handleCheckDuplicates(req, res, next) {
  try {
    const duplicates = await detectPotentialDuplicates(req.body, req.query.excludeId);
    return ApiResponse.success(res, duplicates, 'Duplicate check completed');
  } catch (error) {
    next(error);
  }
}
