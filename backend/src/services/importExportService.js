import * as XLSX from 'xlsx';
import { dbStore } from './store.js';
import { sanitizeCsvCell } from '../utils/sanitize.js';
import { logAuditEvent } from './auditService.js';
import { evaluateDataQuality, detectPotentialDuplicates } from './voterService.js';

/**
 * Parse Excel (.xlsx/.xls) or CSV buffer/text into standardized array of row objects
 */
export function parseSpreadsheet(bufferOrText, filename = '') {
  let workbook;
  try {
    if (Buffer.isBuffer(bufferOrText)) {
      workbook = XLSX.read(bufferOrText, { type: 'buffer' });
    } else if (typeof bufferOrText === 'string') {
      workbook = XLSX.read(bufferOrText, { type: 'string' });
    } else {
      throw new Error('Unsupported input format');
    }
  } catch (err) {
    throw new Error(`Failed to parse spreadsheet file: ${err.message}`);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Spreadsheet contains no worksheets');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('Spreadsheet file is empty or missing data rows');
  }

  const MAX_IMPORT_ROWS = 2500;
  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `Spreadsheet contains ${rawRows.length} rows, which exceeds the maximum batch limit of ${MAX_IMPORT_ROWS} rows. Please split datasets into batches of up to 1,500 rows.`
    );
  }

  // Normalize headers: strip quotes, trim, uppercase
  const firstRow = rawRows[0];
  const originalKeys = Object.keys(firstRow);
  const normalizedKeyMap = {};
  originalKeys.forEach((key) => {
    const cleanKey = key.trim().replace(/^["']|["']$/g, '').toUpperCase();
    normalizedKeyMap[key] = cleanKey;
  });

  const availableHeaders = Object.values(normalizedKeyMap);
  const hasSerialHeader =
    availableHeaders.includes('BOOTH_SERIAL_NO') ||
    availableHeaders.includes('BOOTH_SERIAL_NUMBER') ||
    availableHeaders.includes('SERIAL_NO') ||
    availableHeaders.includes('BOOTH_SL_NO');

  const requiredHeaders = ['FULL_NAME'];
  const missingHeaders = requiredHeaders.filter((h) => !availableHeaders.includes(h));
  if (!hasSerialHeader && !availableHeaders.includes('EPIC_NO')) {
    missingHeaders.unshift('BOOTH_SERIAL_NO');
  }

  if (missingHeaders.length > 0) {
    throw new Error(`Spreadsheet is missing mandatory columns: ${missingHeaders.join(', ')}`);
  }

  // Map all rows with normalized headers
  const rows = [];
  rawRows.forEach((row, idx) => {
    const rowObj = {};
    Object.keys(row).forEach((origKey) => {
      const normKey = normalizedKeyMap[origKey] || origKey.trim().toUpperCase();
      let val = row[origKey];
      if (typeof val === 'string') val = val.trim();
      rowObj[normKey] = val !== undefined && val !== null ? String(val) : '';
    });
    // row 2 is the first data row after headers in spreadsheet
    rows.push({ index: idx + 2, ...rowObj });
  });

  return rows;
}

/**
 * Backward compatibility parser for raw CSV string
 */
export function parseCsvText(csvText) {
  return parseSpreadsheet(csvText);
}

/**
 * Normalize booth identifier to support whole numbers (e.g. 42, 43, 44, 45) or alphanumeric strings
 */
export function normalizeBoothKey(val) {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (str === '') return '';
  const num = Number(str);
  if (!isNaN(num) && Number.isInteger(num)) {
    return String(num);
  }
  return str;
}

/**
 * Normalize gender input string or shorthand ('M', 'F', 'T', 'Male', 'Female') into standard values
 */
export function normalizeGender(val) {
  if (!val) return 'Male';
  const clean = String(val).trim().toLowerCase();
  if (['m', 'male', 'man', 'he'].includes(clean)) return 'Male';
  if (['f', 'female', 'woman', 'she'].includes(clean)) return 'Female';
  if (['t', 'tg', 'third gender', 'other', 'transgender'].includes(clean)) return 'Third Gender';
  return 'Male';
}

/**
 * Generate official XLSX template for voter imports
 */
export function generateSampleXlsx() {
  const sampleData = [
    {
      BOOTH_SERIAL_NO: 1,
      BOOTH_NUMBER: 42,
      FULL_NAME: 'Harpreet Singh Sandhu',
      GENDER: 'Male',
      AGE: 38,
      RELATIVE_NAME: 'Jagjit Singh Sandhu',
      RELATION_TYPE: 'Father',
      FAMILY_ROLE: 'FH',
      FAMILY_HEAD_SERIAL: '',
      MOBILE_NUMBER: '9814012345',
      HOUSE_NO: '142-A',
      STREET: 'Model Town Main Road',
      LOCALITY: 'Model Town',
      WARD: '12',
      DISTRICT: 'Patiala',
      STATE: 'Punjab',
      EPIC_NO: 'PB1049281',
    },
    {
      BOOTH_SERIAL_NO: 2,
      BOOTH_NUMBER: 42,
      FULL_NAME: 'Jasleen Kaur Sandhu',
      GENDER: 'Female',
      AGE: 35,
      RELATIVE_NAME: 'Harpreet Singh Sandhu',
      RELATION_TYPE: 'Husband',
      FAMILY_ROLE: 'FM',
      FAMILY_HEAD_SERIAL: 1,
      MOBILE_NUMBER: '9814012346',
      HOUSE_NO: '142-A',
      STREET: 'Model Town Main Road',
      LOCALITY: 'Model Town',
      WARD: '12',
      DISTRICT: 'Patiala',
      STATE: 'Punjab',
      EPIC_NO: 'PB1049282',
    },
    {
      BOOTH_SERIAL_NO: 1,
      BOOTH_NUMBER: 43,
      FULL_NAME: 'Gurkirat Singh Dhillon',
      GENDER: 'Male',
      AGE: 28,
      RELATIVE_NAME: 'Amrik Singh Dhillon',
      RELATION_TYPE: 'Father',
      FAMILY_ROLE: 'SM',
      FAMILY_HEAD_SERIAL: '',
      MOBILE_NUMBER: '9872012345',
      HOUSE_NO: 'SCO 24',
      STREET: 'Mall Road',
      LOCALITY: 'Leela Bhawan',
      WARD: '12',
      DISTRICT: 'Patiala',
      STATE: 'Punjab',
      EPIC_NO: 'PB2093842',
    },
    {
      BOOTH_SERIAL_NO: 1,
      BOOTH_NUMBER: 44,
      FULL_NAME: 'Simranjit Kaur Mann',
      GENDER: 'Female',
      AGE: 22,
      RELATIVE_NAME: 'Manpreet Singh Mann',
      RELATION_TYPE: 'Father',
      FAMILY_ROLE: 'SM',
      FAMILY_HEAD_SERIAL: '',
      MOBILE_NUMBER: '9876543210',
      HOUSE_NO: 'Plot 512',
      STREET: 'Sector 2 Main Avenue',
      LOCALITY: 'Urban Estate Phase 2',
      WARD: '12',
      DISTRICT: 'Patiala',
      STATE: 'Punjab',
      EPIC_NO: 'PB3910295',
    },
    {
      BOOTH_SERIAL_NO: 1,
      BOOTH_NUMBER: 45,
      FULL_NAME: 'Davinder Singh Sidhu',
      GENDER: 'Male',
      AGE: 50,
      RELATIVE_NAME: 'Gurmukh Singh Sidhu',
      RELATION_TYPE: 'Father',
      FAMILY_ROLE: 'SM',
      FAMILY_HEAD_SERIAL: '',
      MOBILE_NUMBER: '9815012345',
      HOUSE_NO: '78',
      STREET: 'Top Khana Gate Road',
      LOCALITY: 'Top Khana Gate',
      WARD: '12',
      DISTRICT: 'Patiala',
      STATE: 'Punjab',
      EPIC_NO: 'PB4910296',
    },
    {
      BOOTH_SERIAL_NO: 1,
      BOOTH_NUMBER: 46,
      FULL_NAME: 'Manpreet Kaur Cheema',
      GENDER: 'Female',
      AGE: 29,
      RELATIVE_NAME: 'Hardeep Singh Cheema',
      RELATION_TYPE: 'Husband',
      FAMILY_ROLE: 'SM',
      FAMILY_HEAD_SERIAL: '',
      MOBILE_NUMBER: '9815012346',
      HOUSE_NO: '12-B',
      STREET: 'Old Police Lines Road',
      LOCALITY: 'Old Police Lines',
      WARD: '12',
      DISTRICT: 'Patiala',
      STATE: 'Punjab',
      EPIC_NO: 'PB5910297',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  // Column formatting
  ws['!cols'] = [
    { wch: 18 }, // BOOTH_SERIAL_NO
    { wch: 16 }, // BOOTH_NUMBER
    { wch: 24 }, // FULL_NAME
    { wch: 10 }, // GENDER
    { wch: 8 },  // AGE
    { wch: 22 }, // RELATIVE_NAME
    { wch: 14 }, // RELATION_TYPE
    { wch: 14 }, // FAMILY_ROLE
    { wch: 20 }, // FAMILY_HEAD_SERIAL
    { wch: 14 }, // HOUSE_NO
    { wch: 22 }, // STREET
    { wch: 20 }, // LOCALITY
    { wch: 12 }, // WARD
    { wch: 18 }, // DISTRICT
    { wch: 14 }, // STATE
    { wch: 16 }, // EPIC_NO
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Voter Import Template');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Preview spreadsheet (XLSX / CSV) import with schema validation and duplicate checking
 */
export async function previewSpreadsheetImport(bufferOrContent, filename = '') {
  const rawRows = parseSpreadsheet(bufferOrContent, filename);
  const validRows = [];
  const errors = [];
  const duplicateRows = [];

  const boothMap = new Map();
  const allBooths = await dbStore.pollingStations.find();
  allBooths.forEach((b) => {
    const rawKey = String(b.officialBoothNumber).trim();
    boothMap.set(rawKey, b._id || b.id);
    const normKey = normalizeBoothKey(rawKey);
    if (normKey) boothMap.set(normKey, b._id || b.id);
  });

  // Track seen identifiers within the uploaded spreadsheet to detect intra-file duplicates
  const seenBoothSerials = new Map(); // key: `${boothKey}:${boothSerialNumber}` => { row, name, epic }
  const seenEpics = new Map(); // key: epic => { row, name, boothSerialNumber, boothNumber }
  const seenNames = new Map(); // key: `${fullName}:${relativeName}` => { row, name }

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    const rowNumber = row.index || idx + 1;
    const rowErrors = [];

    // Parse primary Booth Serial Number
    const rawSerial =
      row.BOOTH_SERIAL_NO || row.BOOTH_SERIAL_NUMBER || row.SERIAL_NO || row.BOOTH_SL_NO;
    let boothSerialNumber = rawSerial ? parseInt(rawSerial, 10) : idx + 1;

    if (isNaN(boothSerialNumber) || boothSerialNumber <= 0) {
      rowErrors.push('BOOTH_SERIAL_NO must be a valid positive number');
    }

    const epic = (row.EPIC_NO || row.EPIC_NUMBER || '').trim().toUpperCase();
    const fullName = (row.FULL_NAME || '').trim();
    const rawAge = row.AGE ? parseInt(row.AGE, 10) : null;
    const age = rawAge !== null && !isNaN(rawAge) && rawAge >= 18 && rawAge <= 120 ? rawAge : 18;
    const rawGender = (row.GENDER || '').trim();
    const gender = normalizeGender(rawGender);
    const city = (row.CITY || '').trim() || 'Patiala';
    const pin = (row.PIN_CODE || row.PINCODE || row.PIN || '').trim();
    const pinCode = pin && /^[1-9][0-9]{5}$/.test(pin) ? pin : '147001';
    const rawBooth = row.BOOTH_NUMBER || row.BOOTH_NO || row.BOOTH || '';
    const boothNumber = normalizeBoothKey(rawBooth);

    if (!fullName) rowErrors.push('FULL_NAME is required');

    const boothId = boothNumber ? boothMap.get(boothNumber) || boothMap.get(String(rawBooth).trim()) || null : null;
    if (boothNumber && !boothId) {
      rowErrors.push(`Polling booth "${boothNumber}" does not exist in master records`);
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        boothSerialNumber: boothSerialNumber || idx + 1,
        epic: epic || 'N/A',
        name: fullName || 'N/A',
        errors: rowErrors,
      });
      continue;
    }

    // Duplicate detection flags & reasons
    const rowDuplicateFlags = [];
    const rowDuplicateReasons = [];
    const conflictSources = [];
    let existingDbId = null;

    const boothKey = boothId || boothNumber;

    // 1. Check Booth Serial ID duplicate (Intra-file duplicate check)
    if (boothKey && boothSerialNumber) {
      const serialMapKey = `${boothKey}:${boothSerialNumber}`;
      if (seenBoothSerials.has(serialMapKey)) {
        const prior = seenBoothSerials.get(serialMapKey);
        rowDuplicateFlags.push('DUPLICATE_SERIAL_ID');
        rowDuplicateReasons.push(
          `Duplicate Booth Serial #${boothSerialNumber} in Polling Booth "${boothNumber || 'Selected'}" (matches Spreadsheet Row #${prior.row} - ${prior.name})`
        );
        conflictSources.push(`Spreadsheet Row #${prior.row} (${prior.name})`);
      } else {
        seenBoothSerials.set(serialMapKey, { row: rowNumber, name: fullName, epic });
      }

      // Check against Database for existing voter with same boothSerialNumber in booth
      if (boothId) {
        const existingInBooth = await dbStore.voters.findOne({
          pollingStationId: boothId,
          boothSerialNumber,
          isArchived: false,
        });
        if (existingInBooth) {
          if (!rowDuplicateFlags.includes('DUPLICATE_SERIAL_ID')) {
            rowDuplicateFlags.push('DUPLICATE_SERIAL_ID');
          }
          rowDuplicateReasons.push(
            `Booth Serial #${boothSerialNumber} already registered in Polling Booth "${boothNumber}" (to ${existingInBooth.fullName})`
          );
          conflictSources.push(`Database Record #${existingInBooth.boothSerialNumber} (${existingInBooth.fullName})`);
          existingDbId = existingInBooth._id || existingInBooth.id;
        }
      }
    }

    // 2. Check EPIC Number duplicate (Intra-file duplicate check)
    if (epic) {
      if (seenEpics.has(epic)) {
        const prior = seenEpics.get(epic);
        if (!rowDuplicateFlags.includes('DUPLICATE_EPIC_NUMBER')) {
          rowDuplicateFlags.push('DUPLICATE_EPIC_NUMBER');
        }
        rowDuplicateReasons.push(
          `Duplicate EPIC number "${epic}" within this file (matches Spreadsheet Row #${prior.row} - ${prior.name})`
        );
        conflictSources.push(`Spreadsheet Row #${prior.row} (${prior.name})`);
      } else {
        seenEpics.set(epic, { row: rowNumber, name: fullName, boothSerialNumber, boothNumber });
      }

      // Check against Database for existing voter with same EPIC
      const existingEpic = await dbStore.voters.findOne({ epicNumber: epic, isArchived: false });
      if (existingEpic) {
        if (!rowDuplicateFlags.includes('DUPLICATE_EPIC_NUMBER')) {
          rowDuplicateFlags.push('DUPLICATE_EPIC_NUMBER');
        }
        rowDuplicateReasons.push(
          `EPIC number "${epic}" is already registered in database (to ${existingEpic.fullName})`
        );
        conflictSources.push(`Database Record (${existingEpic.fullName})`);
        existingDbId = existingDbId || existingEpic._id || existingEpic.id;
      }
    }

    // 3. Check Name + Relative Name duplicate (Intra-file potential duplicate)
    const relName = (row.RELATIVE_NAME || '').trim();
    if (fullName && relName) {
      const nameKey = `${fullName.toLowerCase()}:${relName.toLowerCase()}`;
      if (seenNames.has(nameKey)) {
        const prior = seenNames.get(nameKey);
        if (rowDuplicateFlags.length === 0) {
          rowDuplicateFlags.push('POTENTIAL_DUPLICATE_DETECTED');
          rowDuplicateReasons.push(
            `Identical Full Name "${fullName}" & Relative "${relName}" (matches Spreadsheet Row #${prior.row})`
          );
          conflictSources.push(`Spreadsheet Row #${prior.row} (${prior.name})`);
        }
      } else {
        seenNames.set(nameKey, { row: rowNumber, name: fullName });
      }
    }

    const isDuplicate = rowDuplicateFlags.length > 0;

    if (isDuplicate) {
      duplicateRows.push({
        row: rowNumber,
        boothSerialNumber,
        boothNumber: boothNumber || 'N/A',
        epic: epic || '—',
        name: fullName,
        relativeName: relName || '—',
        duplicateType: rowDuplicateFlags.join(', '),
        duplicateFlags: rowDuplicateFlags,
        reason: rowDuplicateReasons.join(' | '),
        conflictWith: conflictSources.join('; ') || 'Conflict Detected',
        existingId: existingDbId,
      });
    }

    // Parse familyRole and familyHeadSerial
    const rawRole = (row.FAMILY_ROLE || row.FAMILY_NOTATION || row.ROLE || '').trim().toUpperCase();
    const familyRole = ['FH', 'FM', 'SM'].includes(rawRole) ? rawRole : 'SM';
    const rawHeadSerial =
      row.FAMILY_HEAD_SERIAL || row.FAMILY_HEAD_SL_NO || row.HEAD_SERIAL_NO || row.FAMILY_HEAD_BOOTH_SERIAL;
    const familyHeadSerial = rawHeadSerial ? parseInt(rawHeadSerial, 10) : null;
    const mobileNumber = (row.MOBILE_NUMBER || row.MOBILE || row.PHONE || row.PHONE_NUMBER || '').trim();

    validRows.push({
      rowNumber,
      boothSerialNumber,
      epicNumber: epic,
      fullName,
      mobileNumber,
      relativeName: relName,
      relationType: ['Father', 'Mother', 'Husband', 'Other'].includes(row.RELATION_TYPE)
        ? row.RELATION_TYPE
        : 'Father',
      familyRole,
      familyHeadSerial: familyRole === 'FM' ? familyHeadSerial : null,
      familyHeadId: null,
      gender,
      age,
      address: {
        houseNumber: row.HOUSE_NO || '',
        street: row.STREET || '',
        locality: row.LOCALITY || '',
        villageWard: (row.WARD || row.VILLAGE_WARD || row.WARD_NO || row.WARD_NUMBER || '').trim() || '12',
        city,
        district: row.DISTRICT || 'Patiala',
        state: row.STATE || 'Punjab',
        pinCode,
        country: 'India',
        verified: false,
      },
      pollingStationId: boothId,
      boothNumber: boothNumber || '',
      isDuplicate,
      duplicateFlags: rowDuplicateFlags,
      duplicateReason: isDuplicate ? rowDuplicateReasons.join(' | ') : null,
      verificationStatus: 'Verified',
    });
  }

  const cleanCount = validRows.filter((r) => !r.isDuplicate).length;

  return {
    totalRows: rawRows.length,
    validCount: validRows.length,
    cleanCount,
    duplicateCount: duplicateRows.length,
    errorCount: errors.length,
    validRows, // Returns all validated rows for commit (supports up to 1,500+ records)
    duplicateRows,
    errors,
  };
}

// Alias for backwards compatibility
export const previewCsvImport = previewSpreadsheetImport;

/**
 * Commit validated rows with automatic Family Head linking and duplicate record management
 */
export async function commitCsvImport(rows, actor, reqMeta = {}, options = {}) {
  const skipDuplicates = Boolean(options.skipDuplicates);
  let importedCount = 0;
  let flaggedDuplicateCount = 0;
  let skippedDuplicateCount = 0;
  const createdIds = [];
  const headMap = new Map(); // key: `${pollingStationId}:${boothSerialNumber}` => voterId
  const boothCountMap = new Map(); // key: boothId => incremental voterCount

  // If user selected to skip duplicates, filter them out before processing
  let targetRows = rows;
  if (skipDuplicates) {
    targetRows = rows.filter((r) => !r.isDuplicate);
    skippedDuplicateCount = rows.length - targetRows.length;
  }

  // Pass 1: Insert Family Heads (FH) and Single Members (SM)
  const nonMemberRows = targetRows.filter((r) => r.familyRole !== 'FM');
  const memberRows = targetRows.filter((r) => r.familyRole === 'FM');

  for (const row of nonMemberRows) {
    const conflictingDbVoters = [];

    if (row.pollingStationId && row.boothSerialNumber) {
      const existingInBooth = await dbStore.voters.findOne({
        pollingStationId: row.pollingStationId,
        boothSerialNumber: row.boothSerialNumber,
        isArchived: false,
      });
      if (existingInBooth) {
        if (existingInBooth.familyRole === 'FH') {
          headMap.set(
            `${row.pollingStationId}:${row.boothSerialNumber}`,
            existingInBooth._id || existingInBooth.id
          );
        }
        conflictingDbVoters.push({ voter: existingInBooth, flag: 'DUPLICATE_SERIAL_ID' });
      }
    }

    if (row.epicNumber) {
      const existingEpic = await dbStore.voters.findOne({
        epicNumber: row.epicNumber,
        isArchived: false,
      });
      if (existingEpic) {
        conflictingDbVoters.push({ voter: existingEpic, flag: 'DUPLICATE_EPIC_NUMBER' });
      }
    }

    // Aggregate duplicate flags from preview and conflicting DB records
    const rowDupFlags = Array.from(new Set([
      ...(row.duplicateFlags || []),
      ...conflictingDbVoters.map((c) => c.flag),
    ]));
    const isRowDuplicate = row.isDuplicate || rowDupFlags.length > 0;
    if (isRowDuplicate) flaggedDuplicateCount++;

    // Flag conflicting existing DB records so both records appear in Data Quality review
    for (const { voter: ev, flag } of conflictingDbVoters) {
      const evDupFlags = Array.isArray(ev.duplicateFlags) ? ev.duplicateFlags : [];
      const evDqFlags = Array.isArray(ev.dataQualityFlags) ? ev.dataQualityFlags : [];
      await dbStore.voters.updateOne(
        { _id: ev._id || ev.id },
        {
          $set: {
            isDuplicate: true,
            duplicateFlags: Array.from(new Set([...evDupFlags, flag])),
            dataQualityFlags: Array.from(new Set([...evDqFlags, flag])),
            updatedBy: actor?._id || actor?.id,
          },
        }
      );
    }

    const { familyHeadSerial, rowNumber, boothNumber, duplicateReason, ...cleanData } = row;
    const dataQualityFlags = evaluateDataQuality({
      ...cleanData,
      isDuplicate: isRowDuplicate,
      duplicateFlags: rowDupFlags,
    });

    const newVoter = await dbStore.voters.create({
      ...cleanData,
      familyRole: cleanData.familyRole || 'SM',
      familyHeadId: null,
      verificationStatus: 'Verified',
      isDuplicate: isRowDuplicate,
      duplicateFlags: rowDupFlags,
      dataQualityFlags,
      createdBy: actor?._id || actor?.id,
      updatedBy: actor?._id || actor?.id,
    });

    const newVoterId = newVoter._id || newVoter.id;
    if (newVoter.familyRole === 'FH') {
      headMap.set(`${newVoter.pollingStationId}:${newVoter.boothSerialNumber}`, newVoterId);
    }

    if (newVoter.pollingStationId) {
      const bId = String(newVoter.pollingStationId);
      boothCountMap.set(bId, (boothCountMap.get(bId) || 0) + 1);
    }

    importedCount++;
    createdIds.push(newVoterId);
  }

  // Pass 2: Insert Family Members (FM) and link to corresponding Family Head
  for (const row of memberRows) {
    const conflictingDbVoters = [];

    if (row.pollingStationId && row.boothSerialNumber) {
      const existingInBooth = await dbStore.voters.findOne({
        pollingStationId: row.pollingStationId,
        boothSerialNumber: row.boothSerialNumber,
        isArchived: false,
      });
      if (existingInBooth) {
        conflictingDbVoters.push({ voter: existingInBooth, flag: 'DUPLICATE_SERIAL_ID' });
      }
    }

    if (row.epicNumber) {
      const existingEpic = await dbStore.voters.findOne({
        epicNumber: row.epicNumber,
        isArchived: false,
      });
      if (existingEpic) {
        conflictingDbVoters.push({ voter: existingEpic, flag: 'DUPLICATE_EPIC_NUMBER' });
      }
    }

    const rowDupFlags = Array.from(new Set([
      ...(row.duplicateFlags || []),
      ...conflictingDbVoters.map((c) => c.flag),
    ]));
    const isRowDuplicate = row.isDuplicate || rowDupFlags.length > 0;
    if (isRowDuplicate) flaggedDuplicateCount++;

    for (const { voter: ev, flag } of conflictingDbVoters) {
      const evDupFlags = Array.isArray(ev.duplicateFlags) ? ev.duplicateFlags : [];
      const evDqFlags = Array.isArray(ev.dataQualityFlags) ? ev.dataQualityFlags : [];
      await dbStore.voters.updateOne(
        { _id: ev._id || ev.id },
        {
          $set: {
            isDuplicate: true,
            duplicateFlags: Array.from(new Set([...evDupFlags, flag])),
            dataQualityFlags: Array.from(new Set([...evDqFlags, flag])),
            updatedBy: actor?._id || actor?.id,
          },
        }
      );
    }

    let resolvedHeadId = null;
    if (row.familyHeadSerial) {
      const key = `${row.pollingStationId}:${row.familyHeadSerial}`;
      if (headMap.has(key)) {
        resolvedHeadId = headMap.get(key);
      } else if (row.pollingStationId) {
        const existingHead = await dbStore.voters.findOne({
          pollingStationId: row.pollingStationId,
          boothSerialNumber: row.familyHeadSerial,
          familyRole: 'FH',
          isArchived: false,
        });
        if (existingHead) {
          resolvedHeadId = existingHead._id || existingHead.id;
        }
      }
    }

    const { familyHeadSerial, rowNumber, boothNumber, duplicateReason, ...cleanData } = row;
    const dataQualityFlags = evaluateDataQuality({
      ...cleanData,
      isDuplicate: isRowDuplicate,
      duplicateFlags: rowDupFlags,
    });
    if (!resolvedHeadId) {
      dataQualityFlags.push('UNLINKED_FAMILY_MEMBER');
    }

    const newVoter = await dbStore.voters.create({
      ...cleanData,
      familyRole: 'FM',
      familyHeadId: resolvedHeadId,
      verificationStatus: 'Verified',
      isDuplicate: isRowDuplicate,
      duplicateFlags: rowDupFlags,
      dataQualityFlags,
      createdBy: actor?._id || actor?.id,
      updatedBy: actor?._id || actor?.id,
    });

    if (newVoter.pollingStationId) {
      const bId = String(newVoter.pollingStationId);
      boothCountMap.set(bId, (boothCountMap.get(bId) || 0) + 1);
    }

    importedCount++;
    createdIds.push(newVoter._id || newVoter.id);
  }

  // Batch update polling station voter counts
  for (const [boothId, count] of boothCountMap.entries()) {
    await dbStore.pollingStations.updateOne(
      { _id: boothId },
      { $inc: { voterCount: count } }
    );
  }

  await logAuditEvent({
    actor,
    action: 'BULK_IMPORT',
    entityType: 'IMPORT_JOB',
    outcome: 'SUCCESS',
    ipAddress: reqMeta.ipAddress || '127.0.0.1',
    userAgent: reqMeta.userAgent || '',
    details: {
      importedCount,
      totalRequested: rows.length,
      flaggedDuplicateCount,
      skippedDuplicateCount,
    },
  });

  return {
    success: true,
    importedCount,
    flaggedDuplicateCount,
    skippedDuplicateCount,
  };
}



export async function exportVotersToCsv({ filter = {}, actor, reqMeta = {} }) {
  const MAX_EXPORT_LIMIT = 5000;
  const { records } = await dbStore.voters.query({
    filter: { ...filter, isArchived: false },
    limit: MAX_EXPORT_LIMIT,
  });

  const headers = [
    'BOOTH_SERIAL_NO',
    'BOOTH_NUMBER',
    'FULL_NAME',
    'MOBILE_NUMBER',
    'RELATIVE_NAME',
    'RELATION',
    'FAMILY_ROLE',
    'FAMILY_HEAD',
    'GENDER',
    'AGE',
    'CITY',
    'DISTRICT',
    'STATE',
    'PIN_CODE',
    'EPIC_NUMBER',
    'DUPLICATE_STATUS',
    'VOTER_ID',
  ];

  const csvRows = [headers.join(',')];

  for (const v of records) {
    const headDisplay = v.familyHead
      ? `#${v.familyHead.boothSerialNumber || ''} ${v.familyHead.fullName || ''}`.trim()
      : '';
    const isDupSerial = v.duplicateFlags?.includes('DUPLICATE_SERIAL_ID') || v.dataQualityFlags?.includes('DUPLICATE_SERIAL_ID');
    const isDupEpic = v.duplicateFlags?.includes('DUPLICATE_EPIC_NUMBER') || v.dataQualityFlags?.includes('DUPLICATE_EPIC_NUMBER');
    const dupStatus = isDupSerial && isDupEpic ? 'DUPLICATE_SERIAL_AND_EPIC' : isDupSerial ? 'DUPLICATE_SERIAL_ID' : isDupEpic ? 'DUPLICATE_EPIC_NUMBER' : 'UNIQUE';

    const row = [
      sanitizeCsvCell(v.boothSerialNumber || ''),
      sanitizeCsvCell(v.pollingStationId?.officialBoothNumber || ''),
      sanitizeCsvCell(v.fullName),
      sanitizeCsvCell(v.mobileNumber || ''),
      sanitizeCsvCell(v.relativeName || ''),
      sanitizeCsvCell(v.relationType || ''),
      sanitizeCsvCell(v.familyRole || 'SM'),
      sanitizeCsvCell(headDisplay),
      sanitizeCsvCell(v.gender),
      sanitizeCsvCell(v.age),
      sanitizeCsvCell(v.address?.city || ''),
      sanitizeCsvCell(v.address?.district || ''),
      sanitizeCsvCell(v.address?.state || ''),
      sanitizeCsvCell(v.address?.pinCode || ''),
      sanitizeCsvCell(v.epicNumber || ''),
      sanitizeCsvCell(dupStatus),
      sanitizeCsvCell(v._id || v.id),
    ];
    csvRows.push(row.map((cell) => `"${cell}"`).join(','));
  }

  await logAuditEvent({
    actor,
    action: 'DATA_EXPORT',
    entityType: 'EXPORT_JOB',
    outcome: 'SUCCESS',
    ipAddress: reqMeta.ipAddress || '127.0.0.1',
    userAgent: reqMeta.userAgent || '',
    details: {
      exportedRows: records.length,
      filtersApplied: Object.keys(filter),
    },
  });

  return {
    csvContent: csvRows.join('\n'),
    rowCount: records.length,
  };
}

/**
 * Export voter data as XLSX spreadsheet
 */
export async function exportVotersToXlsx({ filter = {}, actor, reqMeta = {} }) {
  const MAX_EXPORT_LIMIT = 5000;
  const { records } = await dbStore.voters.query({
    filter: { ...filter, isArchived: false },
    limit: MAX_EXPORT_LIMIT,
  });

  const exportRows = records.map((v) => {
    const isDupSerial = v.duplicateFlags?.includes('DUPLICATE_SERIAL_ID') || v.dataQualityFlags?.includes('DUPLICATE_SERIAL_ID');
    const isDupEpic = v.duplicateFlags?.includes('DUPLICATE_EPIC_NUMBER') || v.dataQualityFlags?.includes('DUPLICATE_EPIC_NUMBER');
    const dupStatus = isDupSerial && isDupEpic ? 'DUPLICATE_SERIAL_AND_EPIC' : isDupSerial ? 'DUPLICATE_SERIAL_ID' : isDupEpic ? 'DUPLICATE_EPIC_NUMBER' : 'UNIQUE';

    return {
      BOOTH_SERIAL_NO: v.boothSerialNumber || '',
      BOOTH_NUMBER: v.pollingStationId?.officialBoothNumber || '',
      FULL_NAME: v.fullName,
      MOBILE_NUMBER: v.mobileNumber || '',
      RELATIVE_NAME: v.relativeName || '',
      RELATION: v.relationType || '',
      FAMILY_ROLE: v.familyRole || 'SM',
      FAMILY_HEAD: v.familyHead
        ? `#${v.familyHead.boothSerialNumber || ''} ${v.familyHead.fullName || ''}`.trim()
        : '',
      GENDER: v.gender,
      AGE: v.age,
      CITY: v.address?.city || '',
      DISTRICT: v.address?.district || '',
      STATE: v.address?.state || '',
      PIN_CODE: v.address?.pinCode || '',
      EPIC_NUMBER: v.epicNumber || '',
      DUPLICATE_STATUS: dupStatus,
      VOTER_ID: v._id || v.id,
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportRows);
  ws['!cols'] = [
    { wch: 18 }, // BOOTH_SERIAL_NO
    { wch: 16 }, // BOOTH_NUMBER
    { wch: 24 }, // FULL_NAME
    { wch: 16 }, // MOBILE_NUMBER
    { wch: 20 }, // RELATIVE_NAME
    { wch: 14 }, // RELATION
    { wch: 14 }, // FAMILY_ROLE
    { wch: 22 }, // FAMILY_HEAD
    { wch: 10 }, // GENDER
    { wch: 8 },  // AGE
    { wch: 16 }, // CITY
    { wch: 18 }, // DISTRICT
    { wch: 14 }, // STATE
    { wch: 12 }, // PIN_CODE
    { wch: 14 }, // EPIC_NUMBER
    { wch: 22 }, // VERIFICATION_STATUS
    { wch: 28 }, // VOTER_ID
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Voter Directory');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  await logAuditEvent({
    actor,
    action: 'DATA_EXPORT',
    entityType: 'EXPORT_JOB',
    outcome: 'SUCCESS',
    ipAddress: reqMeta.ipAddress || '127.0.0.1',
    userAgent: reqMeta.userAgent || '',
    details: {
      exportedRows: records.length,
      format: 'xlsx',
      filtersApplied: Object.keys(filter),
    },
  });

  return {
    buffer,
    rowCount: records.length,
  };
}

export const commitSpreadsheetImport = commitCsvImport;
