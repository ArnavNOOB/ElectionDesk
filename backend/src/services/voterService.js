import { dbStore } from './store.js';
import { logAuditEvent } from './auditService.js';
import { escapeRegex } from '../utils/sanitize.js';

/**
 * Computes Data Quality Flags for a voter record
 */
export function evaluateDataQuality(voter) {
  const flags = [];
  if (!voter.boothSerialNumber || Number(voter.boothSerialNumber) <= 0) {
    flags.push('MISSING_BOOTH_SERIAL');
  }
  if (!voter.address?.pinCode || !/^[1-9][0-9]{5}$/.test(voter.address.pinCode)) {
    flags.push('INVALID_OR_MISSING_PIN');
  }
  if (!voter.address?.verified) {
    flags.push('UNVERIFIED_ADDRESS');
  }
  if (!voter.pollingStationId) {
    flags.push('UNASSIGNED_POLLING_BOOTH');
  }
  if (!voter.relativeName || voter.relativeName.trim().length < 2) {
    flags.push('MISSING_RELATIVE_NAME');
  }
  if (!voter.address?.houseNumber && !voter.address?.street) {
    flags.push('INCOMPLETE_RESIDENTIAL_ADDRESS');
  }
  if (voter.familyRole === 'FM' && !voter.familyHeadId) {
    flags.push('UNLINKED_FAMILY_MEMBER');
  }
  if (voter.duplicateFlags && Array.isArray(voter.duplicateFlags)) {
    for (const df of voter.duplicateFlags) {
      if (!flags.includes(df)) flags.push(df);
    }
  }
  if (voter.dataQualityFlags && Array.isArray(voter.dataQualityFlags)) {
    for (const df of voter.dataQualityFlags) {
      if (!flags.includes(df)) flags.push(df);
    }
  }
  return flags;
}

/**
 * Finds potential duplicate voter records using deterministic heuristics:
 * 1. Exact match on Booth Serial Number in the same Polling Station
 * 2. Exact match on EPIC identifier (if provided)
 * 3. Exact match on Full Name + Relative Name
 */
export async function detectPotentialDuplicates(voterData, excludeId = null) {
  const potentialMatches = [];
  const { boothSerialNumber, epicNumber, fullName, relativeName, age, address, pollingStationId } = voterData;

  // 1. Check duplicate Booth Serial Number within same Polling Station
  if (boothSerialNumber && pollingStationId) {
    const stationId = pollingStationId?._id || pollingStationId?.id || pollingStationId;
    const serialMatch = await dbStore.voters.findOne({
      pollingStationId: stationId,
      boothSerialNumber: Number(boothSerialNumber),
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      isArchived: false,
    });
    if (serialMatch) {
      potentialMatches.push({
        candidate: serialMatch,
        confidence: 95,
        type: 'DUPLICATE_SERIAL_ID',
        field: 'boothSerialNumber',
        reason: `Duplicate Booth Serial Number #${boothSerialNumber} already assigned in this polling station`,
      });
    }
  }

  // 2. Check exact EPIC (if supplied)
  if (epicNumber && epicNumber.trim()) {
    const cleanEpic = epicNumber.trim().toUpperCase();
    const epicMatch = await dbStore.voters.findOne({
      epicNumber: cleanEpic,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      isArchived: false,
    });
    if (epicMatch) {
      potentialMatches.push({
        candidate: epicMatch,
        confidence: 90,
        type: 'DUPLICATE_EPIC_NUMBER',
        field: 'epicNumber',
        reason: `Identical Official EPIC Number "${cleanEpic}" already registered to ${epicMatch.fullName}`,
      });
    }
  }

  // 3. Check Name + Relative Name + City/PIN
  if (fullName && relativeName) {
    const { records } = await dbStore.voters.query({
      filter: {
        isArchived: false,
        fullName: { $regex: `^${escapeRegex(fullName.trim())}$`, $options: 'i' },
        relativeName: { $regex: `^${escapeRegex(relativeName.trim())}$`, $options: 'i' },
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      },
      limit: 5,
    });

    for (const match of records) {
      if (!potentialMatches.some((p) => String(p.candidate._id || p.candidate.id) === String(match._id || match.id))) {
        potentialMatches.push({
          candidate: match,
          confidence: 85,
          type: 'DUPLICATE_NAME_RELATION',
          reason: `Identical Full Name "${fullName}" and Relative Name "${relativeName}"`,
        });
      }
    }
  }

  return potentialMatches;
}

export async function listVoters({
  page = 1,
  limit = 20,
  search = '',
  locality = '',
  electoralArea,
  pollingStationId,
  verificationStatus,
  duplicateFilter,
  familyRole,
  familyHeadId,
  hasPhoto,
  dataQualityIssue,
  isArchived = false,
  sortField = 'boothSerialNumber',
  sortOrder = 'asc',
}) {
  const filter = {
    isArchived: Boolean(isArchived),
  };

  if (verificationStatus) {
    filter.verificationStatus = verificationStatus;
  }
  if (duplicateFilter === 'ALL_DUPLICATES') {
    filter.dataQualityFlags = { $in: ['DUPLICATE_SERIAL_ID', 'DUPLICATE_EPIC_NUMBER', 'POTENTIAL_DUPLICATE_DETECTED'] };
  } else if (duplicateFilter === 'DUPLICATE_SERIAL_ID') {
    filter.dataQualityFlags = { $in: ['DUPLICATE_SERIAL_ID'] };
  } else if (duplicateFilter === 'DUPLICATE_EPIC_NUMBER') {
    filter.dataQualityFlags = { $in: ['DUPLICATE_EPIC_NUMBER'] };
  } else if (duplicateFilter === 'CLEAN') {
    filter.dataQualityFlags = { $nin: ['DUPLICATE_SERIAL_ID', 'DUPLICATE_EPIC_NUMBER', 'POTENTIAL_DUPLICATE_DETECTED'] };
  }
  if (pollingStationId) {
    filter.pollingStationId = pollingStationId;
  }
  if (familyRole) {
    filter.familyRole = familyRole;
  }
  if (familyHeadId) {
    filter.familyHeadId = familyHeadId;
  }
  if (hasPhoto === 'true' || hasPhoto === true) {
    filter.photoKey = { $ne: null };
  } else if (hasPhoto === 'false' || hasPhoto === false) {
    filter.photoKey = null;
  }
  if (dataQualityIssue) {
    filter.dataQualityFlags = { $in: [dataQualityIssue] };
  }

  const sort =
    sortField === 'boothSerialNumber'
      ? { boothSerialNumber: sortOrder === 'desc' ? -1 : 1 }
      : { [sortField]: sortOrder === 'asc' ? 1 : -1, boothSerialNumber: 1 };
  const skip = (page - 1) * limit;

  const { records, total } = await dbStore.voters.query({
    filter,
    sort,
    skip,
    limit,
    search: search ? search.trim() : '',
    locality: locality ? locality.trim() : '',
  });

  return {
    records,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getVoterById(id) {
  const voter = await dbStore.voters.findById(id);
  if (!voter) return null;
  const result = { ...voter };

  if (result.familyRole === 'FH') {
    result.familyMembers = await dbStore.voters.getFamilyMembers(result._id || result.id);
  } else if (result.familyRole === 'FM' && result.familyHeadId) {
    result.familyHead = await dbStore.voters.findById(result.familyHeadId);
    const members = await dbStore.voters.getFamilyMembers(result.familyHeadId);
    result.coFamilyMembers = members.filter(
      (m) => String(m._id || m.id) !== String(result._id || result.id)
    );
  }

  return result;
}

export async function listFamilyHeads({ pollingStationId } = {}) {
  return dbStore.voters.getFamilyHeads(pollingStationId);
}

export async function createVoter(data, actor, reqMeta = {}) {
  const boothSerial = Number(data.boothSerialNumber);
  if (!boothSerial || boothSerial <= 0) {
    throw new Error('Booth Serial Number is required as the primary electoral roll identifier.');
  }

  // Validate Family Role and Family Head relationship
  const familyRole = data.familyRole || 'SM';
  let familyHeadId = null;

  if (familyRole === 'FM') {
    if (!data.familyHeadId) {
      throw new Error('A valid Family Head (FH) must be selected for a Family Member (FM).');
    }
    const familyHead = await dbStore.voters.findById(data.familyHeadId);
    if (!familyHead) {
      throw new Error('The selected Family Head (FH) record does not exist.');
    }
    if (familyHead.familyRole !== 'FH') {
      throw new Error('The selected voter is not designated as a Family Head (FH).');
    }
    familyHeadId = familyHead._id || familyHead.id;
  }

  // Check unique Booth Serial Number in the same polling booth if assigned
  if (data.pollingStationId) {
    const existingInBooth = await dbStore.voters.findOne({
      pollingStationId: data.pollingStationId,
      boothSerialNumber: boothSerial,
      isArchived: false,
    });
    if (existingInBooth) {
      throw new Error(`A voter with Booth Serial Number #${boothSerial} is already registered in this polling booth.`);
    }
  }

  // Check EPIC uniqueness only if an EPIC number is provided
  if (data.epicNumber && data.epicNumber.trim()) {
    const existingEpic = await dbStore.voters.findOne({
      epicNumber: data.epicNumber.trim().toUpperCase(),
      isArchived: false,
    });
    if (existingEpic) {
      throw new Error(`A voter record with EPIC number "${data.epicNumber}" already exists.`);
    }
  }

  // Detect duplicates
  const duplicates = await detectPotentialDuplicates(data);
  const dataQualityFlags = evaluateDataQuality(data);
  const duplicateFlags = [];

  for (const match of duplicates) {
    if (match.type === 'DUPLICATE_SERIAL_ID' && !duplicateFlags.includes('DUPLICATE_SERIAL_ID')) {
      duplicateFlags.push('DUPLICATE_SERIAL_ID');
    }
    if (match.type === 'DUPLICATE_EPIC_NUMBER' && !duplicateFlags.includes('DUPLICATE_EPIC_NUMBER')) {
      duplicateFlags.push('DUPLICATE_EPIC_NUMBER');
    }
  }

  if (duplicates.length > 0 && duplicateFlags.length === 0) {
    duplicateFlags.push('POTENTIAL_DUPLICATE_DETECTED');
  }

  for (const df of duplicateFlags) {
    if (!dataQualityFlags.includes(df)) dataQualityFlags.push(df);
  }

  const isDuplicate = duplicateFlags.length > 0;
  const verificationStatus = data.verificationStatus || 'Verified';

  const voterPayload = {
    ...data,
    boothSerialNumber: boothSerial,
    epicNumber: data.epicNumber ? data.epicNumber.trim().toUpperCase() : '',
    mobileNumber: data.mobileNumber ? String(data.mobileNumber).trim() : '',
    familyRole,
    familyHeadId,
    verificationStatus,
    isDuplicate,
    duplicateFlags,
    dataQualityFlags,
    createdBy: actor?._id || actor?.id,
    updatedBy: actor?._id || actor?.id,
  };

  const newVoter = await dbStore.voters.create(voterPayload);

  // Update Polling Station count if assigned
  if (newVoter.pollingStationId) {
    await dbStore.pollingStations.updateOne(
      { _id: newVoter.pollingStationId },
      { $inc: { voterCount: 1 } }
    );
  }

  await logAuditEvent({
    actor,
    action: 'RECORD_CREATE',
    entityType: 'VOTER',
    entityId: newVoter._id || newVoter.id,
    outcome: 'SUCCESS',
    ipAddress: reqMeta.ipAddress || '127.0.0.1',
    userAgent: reqMeta.userAgent || '',
    details: {
      boothSerialNumber: newVoter.boothSerialNumber,
      epicNumber: newVoter.epicNumber,
      familyRole: newVoter.familyRole,
      familyHeadId: newVoter.familyHeadId,
      verificationStatus,
      flags: dataQualityFlags,
    },
  });

  return newVoter;
}

export async function updateVoter(id, updateData, actor, reqMeta = {}) {
  const existing = await dbStore.voters.findById(id);
  if (!existing) {
    throw new Error('Voter record not found');
  }

  // Validate and handle Family Role transitions
  if (updateData.familyRole) {
    if (updateData.familyRole === 'FM') {
      const headId = updateData.familyHeadId !== undefined ? updateData.familyHeadId : existing.familyHeadId;
      if (!headId) {
        throw new Error('A valid Family Head (FH) must be selected for a Family Member (FM).');
      }
      if (String(headId) === String(id)) {
        throw new Error('A voter cannot be their own Family Head.');
      }
      const familyHead = await dbStore.voters.findById(headId);
      if (!familyHead || familyHead.familyRole !== 'FH') {
        throw new Error('The selected Family Head record is invalid or not designated as FH.');
      }
    } else {
      updateData.familyHeadId = null;
      if (existing.familyRole === 'FH' && updateData.familyRole !== 'FH') {
        const linkedMembers = await dbStore.voters.getFamilyMembers(id);
        if (linkedMembers && linkedMembers.length > 0) {
          throw new Error(
            `Cannot change role from Family Head (FH) while ${linkedMembers.length} family member(s) are linked to this record.`
          );
        }
      }
    }
  } else if (updateData.familyHeadId && existing.familyRole === 'FM') {
    if (String(updateData.familyHeadId) === String(id)) {
      throw new Error('A voter cannot be their own Family Head.');
    }
    const familyHead = await dbStore.voters.findById(updateData.familyHeadId);
    if (!familyHead || familyHead.familyRole !== 'FH') {
      throw new Error('The selected Family Head record is invalid or not designated as FH.');
    }
  }

  // Compute minimal diff for accountability without logging sensitive data
  const changedFields = [];
  for (const [key, val] of Object.entries(updateData)) {
    if (JSON.stringify(existing[key]) !== JSON.stringify(val)) {
      changedFields.push(key);
    }
  }

  const merged = { ...existing, ...updateData };
  let dataQualityFlags = evaluateDataQuality(merged);

  if (updateData.clearDuplicates === true || updateData.isDuplicate === false) {
    updateData.isDuplicate = false;
    updateData.duplicateFlags = [];
    dataQualityFlags = dataQualityFlags.filter(
      (f) => !['DUPLICATE_SERIAL_ID', 'DUPLICATE_EPIC_NUMBER', 'POTENTIAL_DUPLICATE_DETECTED'].includes(f)
    );
    delete updateData.clearDuplicates;
  } else if (existing.duplicateFlags && existing.duplicateFlags.length > 0) {
    for (const df of existing.duplicateFlags) {
      if (!dataQualityFlags.includes(df)) dataQualityFlags.push(df);
    }
  }

  const updatedPayload = {
    ...updateData,
    dataQualityFlags,
    updatedBy: actor?._id || actor?.id,
  };

  await dbStore.voters.updateOne({ _id: id }, { $set: updatedPayload });
  const updated = await dbStore.voters.findById(id);

  // If polling station changed, update counts
  if (updateData.pollingStationId && String(updateData.pollingStationId) !== String(existing.pollingStationId?._id || existing.pollingStationId)) {
    if (existing.pollingStationId) {
      await dbStore.pollingStations.updateOne(
        { _id: existing.pollingStationId?._id || existing.pollingStationId },
        { $inc: { voterCount: -1 } }
      );
    }
    await dbStore.pollingStations.updateOne(
      { _id: updateData.pollingStationId },
      { $inc: { voterCount: 1 } }
    );
  }

  await logAuditEvent({
    actor,
    action: 'RECORD_UPDATE',
    entityType: 'VOTER',
    entityId: id,
    outcome: 'SUCCESS',
    ipAddress: reqMeta.ipAddress || '127.0.0.1',
    userAgent: reqMeta.userAgent || '',
    details: {
      epicNumber: existing.epicNumber,
      changedFields,
    },
  });

  return updated;
}

export async function archiveVoter(id, reason, actor, reqMeta = {}) {
  const existing = await dbStore.voters.findById(id);
  if (!existing) throw new Error('Voter record not found');

  await dbStore.voters.updateOne(
    { _id: id },
    {
      $set: {
        isArchived: true,
        archivedAt: new Date(),
        archivedReason: reason || 'Administrative Archival',
        archivedBy: actor?._id || actor?.id,
      },
    }
  );

  if (existing.pollingStationId) {
    await dbStore.pollingStations.updateOne(
      { _id: existing.pollingStationId?._id || existing.pollingStationId },
      { $inc: { voterCount: -1 } }
    );
  }

  await logAuditEvent({
    actor,
    action: 'RECORD_ARCHIVE',
    entityType: 'VOTER',
    entityId: id,
    outcome: 'SUCCESS',
    ipAddress: reqMeta.ipAddress || '127.0.0.1',
    userAgent: reqMeta.userAgent || '',
    details: { reason },
  });

  return { success: true, message: 'Record archived successfully' };
}

export async function restoreVoter(id, actor, reqMeta = {}) {
  const existing = await dbStore.voters.findById(id);
  if (!existing) throw new Error('Voter record not found');

  await dbStore.voters.updateOne(
    { _id: id },
    {
      $set: {
        isArchived: false,
        archivedAt: null,
        archivedReason: null,
        archivedBy: null,
      },
    }
  );

  if (existing.pollingStationId) {
    await dbStore.pollingStations.updateOne(
      { _id: existing.pollingStationId?._id || existing.pollingStationId },
      { $inc: { voterCount: 1 } }
    );
  }

  await logAuditEvent({
    actor,
    action: 'RECORD_RESTORE',
    entityType: 'VOTER',
    entityId: id,
    outcome: 'SUCCESS',
    ipAddress: reqMeta.ipAddress || '127.0.0.1',
    userAgent: reqMeta.userAgent || '',
    details: { epicNumber: existing.epicNumber },
  });

  return { success: true, message: 'Record restored successfully' };
}
