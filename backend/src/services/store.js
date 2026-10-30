import { isDbInMemory } from '../config/db.js';
import UserModel from '../models/User.js';
import VoterModel from '../models/Voter.js';
import PollingStationModel from '../models/PollingStation.js';
import PrivateVoterPhotoModel from '../models/PrivateVoterPhoto.js';
import AuditLogModel from '../models/AuditLog.js';
import SecurityEventModel from '../models/SecurityEvent.js';
import DataGovernanceModel from '../models/DataGovernance.js';
import CommunicationLogModel from '../models/CommunicationLog.js';
import { escapeRegex } from '../utils/sanitize.js';
import crypto from 'crypto';

function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

// In-Memory Storage Cache
const memoryStore = {
  users: new Map(),
  voters: new Map(),
  pollingStations: new Map(),
  photos: new Map(),
  auditLogs: [],
  securityEvents: [],
  governance: new Map(),
  communicationLogs: [],
};

// Helper for flexible phone/mobile number matching
export function phoneMatches(storedNumber, searchStr) {
  if (!storedNumber || !searchStr) return false;
  const storedDigits = String(storedNumber).replace(/\D/g, '');
  const searchDigits = String(searchStr).replace(/\D/g, '');
  if (storedDigits.length < 3 || searchDigits.length < 3) return false;

  if (storedDigits.includes(searchDigits) || searchDigits.includes(storedDigits)) {
    return true;
  }

  // Handle +91 / 91 / 0 prefix differences
  const normStored =
    storedDigits.length === 12 && storedDigits.startsWith('91')
      ? storedDigits.slice(2)
      : storedDigits.length === 11 && storedDigits.startsWith('0')
      ? storedDigits.slice(1)
      : storedDigits;

  const normSearch =
    searchDigits.length === 12 && searchDigits.startsWith('91')
      ? searchDigits.slice(2)
      : searchDigits.length === 11 && searchDigits.startsWith('0')
      ? searchDigits.slice(1)
      : searchDigits;

  if (normStored.includes(normSearch) || normSearch.includes(normStored)) {
    return true;
  }

  return false;
}

// Helper to filter documents in memory
function matchesFilter(doc, filter = {}) {
  for (const [key, val] of Object.entries(filter)) {
    if (key === '_id' || key === 'id') {
      const docId = doc._id ? doc._id.toString() : doc.id?.toString();
      const targetId = val ? val.toString() : '';
      if (docId !== targetId) return false;
      continue;
    }
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof RegExp)) {
      if (val.$ne !== undefined && doc[key] === val.$ne) return false;
      if (val.$in) {
        if (Array.isArray(doc[key])) {
          if (!doc[key].some((item) => val.$in.includes(item))) return false;
        } else if (!val.$in.includes(doc[key])) {
          return false;
        }
      }
      if (val.$nin) {
        if (Array.isArray(doc[key])) {
          if (doc[key].some((item) => val.$nin.includes(item))) return false;
        } else if (val.$nin.includes(doc[key])) {
          return false;
        }
      }
      if (val.$regex) {
        const flags = val.$options || '';
        const regex = new RegExp(val.$regex, flags);
        if (!regex.test(String(doc[key] || ''))) return false;
      }
      continue;
    }
    if (val instanceof RegExp) {
      if (!val.test(String(doc[key] || ''))) return false;
      continue;
    }
    if (key.includes('.')) {
      const parts = key.split('.');
      let nested = doc;
      for (const p of parts) {
        nested = nested ? nested[p] : undefined;
      }
      if (nested !== val) return false;
      continue;
    }
    if (doc[key] !== val) return false;
  }
  return true;
}

export const dbStore = {
  // Clear memory store (useful for tests)
  clearMemoryStore() {
    memoryStore.users.clear();
    memoryStore.voters.clear();
    memoryStore.pollingStations.clear();
    memoryStore.photos.clear();
    memoryStore.auditLogs.length = 0;
    memoryStore.securityEvents.length = 0;
    memoryStore.governance.clear();
    memoryStore.communicationLogs.length = 0;
  },

  // USERS
  users: {
    async findOne(filter) {
      if (!isDbInMemory()) {
        return UserModel.findOne(filter).lean();
      }
      for (const user of memoryStore.users.values()) {
        if (matchesFilter(user, filter)) return { ...user };
      }
      return null;
    },

    async findById(id) {
      if (!isDbInMemory()) {
        return UserModel.findById(id).lean();
      }
      const u = memoryStore.users.get(String(id));
      return u ? { ...u } : null;
    },

    async create(data) {
      if (!isDbInMemory()) {
        const doc = await UserModel.create(data);
        return doc.toObject();
      }
      const _id = generateId();
      const now = new Date();
      const doc = {
        _id,
        id: _id,
        isActive: true,
        failedLoginAttempts: 0,
        sessionVersion: 1,
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      memoryStore.users.set(_id, doc);
      return { ...doc };
    },

    async updateOne(filter, update) {
      if (!isDbInMemory()) {
        return UserModel.updateOne(filter, update);
      }
      for (const [id, user] of memoryStore.users.entries()) {
        if (matchesFilter(user, filter)) {
          const updateData = update.$set || update;
          const updated = {
            ...user,
            ...updateData,
            updatedAt: new Date(),
          };
          if (update.$inc) {
            for (const [field, incVal] of Object.entries(update.$inc)) {
              updated[field] = (updated[field] || 0) + incVal;
            }
          }
          memoryStore.users.set(id, updated);
          return { matchedCount: 1, modifiedCount: 1 };
        }
      }
      return { matchedCount: 0, modifiedCount: 0 };
    },

    async find(filter = {}) {
      if (!isDbInMemory()) {
        return UserModel.find(filter).select('-passwordHash -mfaSecret').lean();
      }
      const results = [];
      for (const u of memoryStore.users.values()) {
        if (matchesFilter(u, filter)) {
          const { passwordHash, mfaSecret, ...safe } = u;
          results.push(safe);
        }
      }
      return results;
    },
  },

  // POLLING STATIONS
  pollingStations: {
    async findOne(filter) {
      if (!isDbInMemory()) {
        return PollingStationModel.findOne(filter).lean();
      }
      for (const booth of memoryStore.pollingStations.values()) {
        if (matchesFilter(booth, filter)) return { ...booth };
      }
      return null;
    },

    async findById(id) {
      if (!isDbInMemory()) {
        return PollingStationModel.findById(id).lean();
      }
      const b = memoryStore.pollingStations.get(String(id));
      return b ? { ...b } : null;
    },

    async create(data) {
      if (!isDbInMemory()) {
        const doc = await PollingStationModel.create(data);
        return doc.toObject();
      }
      const _id = generateId();
      const now = new Date();
      const doc = {
        _id,
        id: _id,
        voterCount: 0,
        status: 'Active',
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      memoryStore.pollingStations.set(_id, doc);
      return { ...doc };
    },

    async updateOne(filter, update) {
      if (!isDbInMemory()) {
        return PollingStationModel.updateOne(filter, update);
      }
      for (const [id, booth] of memoryStore.pollingStations.entries()) {
        if (matchesFilter(booth, filter)) {
          const updateData = update.$set || update;
          const updated = {
            ...booth,
            ...updateData,
            updatedAt: new Date(),
          };
          if (update.$inc) {
            for (const [field, incVal] of Object.entries(update.$inc)) {
              updated[field] = (updated[field] || 0) + incVal;
            }
          }
          memoryStore.pollingStations.set(id, updated);
          return { matchedCount: 1, modifiedCount: 1 };
        }
      }
      return { matchedCount: 0, modifiedCount: 0 };
    },

    async find(filter = {}) {
      if (!isDbInMemory()) {
        return PollingStationModel.find(filter).sort({ officialBoothNumber: 1 }).lean();
      }
      const results = [];
      for (const b of memoryStore.pollingStations.values()) {
        if (matchesFilter(b, filter)) results.push({ ...b });
      }
      return results.sort((a, b) =>
        String(a.officialBoothNumber).localeCompare(String(b.officialBoothNumber), undefined, { numeric: true })
      );
    },

    async countDocuments(filter = {}) {
      if (!isDbInMemory()) {
        return PollingStationModel.countDocuments(filter);
      }
      let count = 0;
      for (const b of memoryStore.pollingStations.values()) {
        if (matchesFilter(b, filter)) count++;
      }
      return count;
    },

    async deleteOne(filter = {}) {
      if (!isDbInMemory()) {
        return PollingStationModel.deleteOne(filter);
      }
      for (const [id, booth] of memoryStore.pollingStations.entries()) {
        if (matchesFilter(booth, filter)) {
          memoryStore.pollingStations.delete(id);
          return { acknowledged: true, deletedCount: 1 };
        }
      }
      return { acknowledged: true, deletedCount: 0 };
    },

    async deleteMany(filter = {}) {
      if (!isDbInMemory()) {
        return PollingStationModel.deleteMany(filter);
      }
      let deletedCount = 0;
      for (const [id, booth] of memoryStore.pollingStations.entries()) {
        if (matchesFilter(booth, filter)) {
          memoryStore.pollingStations.delete(id);
          deletedCount++;
        }
      }
      return { acknowledged: true, deletedCount };
    },
  },

  // VOTERS
  voters: {
    async findOne(filter) {
      if (!isDbInMemory()) {
        return VoterModel.findOne(filter).populate('pollingStationId').populate('familyHeadId', 'fullName boothSerialNumber epicNumber').lean();
      }
      for (const voter of memoryStore.voters.values()) {
        if (matchesFilter(voter, filter)) {
          const res = { ...voter };
          if (res.pollingStationId && typeof res.pollingStationId === 'string') {
            res.pollingStationId = memoryStore.pollingStations.get(res.pollingStationId) || res.pollingStationId;
          }
          if (res.familyHeadId && typeof res.familyHeadId === 'string') {
            const fh = memoryStore.voters.get(res.familyHeadId);
            if (fh) {
              res.familyHead = {
                _id: fh._id,
                id: fh._id,
                fullName: fh.fullName,
                boothSerialNumber: fh.boothSerialNumber,
                epicNumber: fh.epicNumber,
              };
            }
          }
          return res;
        }
      }
      return null;
    },

    async find(filter = {}) {
      if (!isDbInMemory()) {
        return VoterModel.find(filter).populate('pollingStationId').populate('familyHeadId', 'fullName boothSerialNumber epicNumber').lean();
      }
      const results = [];
      for (const voter of memoryStore.voters.values()) {
        if (matchesFilter(voter, filter)) {
          const res = { ...voter };
          if (res.pollingStationId && typeof res.pollingStationId === 'string') {
            res.pollingStationId = memoryStore.pollingStations.get(res.pollingStationId) || res.pollingStationId;
          }
          if (res.familyHeadId && typeof res.familyHeadId === 'string') {
            const fh = memoryStore.voters.get(res.familyHeadId);
            if (fh) {
              res.familyHead = {
                _id: fh._id,
                id: fh._id,
                fullName: fh.fullName,
                boothSerialNumber: fh.boothSerialNumber,
                epicNumber: fh.epicNumber,
              };
            }
          }
          results.push(res);
        }
      }
      return results;
    },

    async findById(id) {
      if (!isDbInMemory()) {
        return VoterModel.findById(id).populate('pollingStationId').populate('familyHeadId', 'fullName boothSerialNumber epicNumber').lean();
      }
      const v = memoryStore.voters.get(String(id));
      if (!v) return null;
      const res = { ...v };
      if (res.pollingStationId && typeof res.pollingStationId === 'string') {
        res.pollingStationId = memoryStore.pollingStations.get(res.pollingStationId) || res.pollingStationId;
      }
      if (res.familyHeadId && typeof res.familyHeadId === 'string') {
        const fh = memoryStore.voters.get(res.familyHeadId);
        if (fh) {
          res.familyHead = {
            _id: fh._id,
            id: fh._id,
            fullName: fh.fullName,
            boothSerialNumber: fh.boothSerialNumber,
            epicNumber: fh.epicNumber,
          };
        }
      }
      return res;
    },

    async create(data) {
      if (!isDbInMemory()) {
        const doc = await VoterModel.create(data);
        return doc.toObject();
      }
      const _id = generateId();
      const now = new Date();
      const doc = {
        _id,
        id: _id,
        familyRole: data.familyRole || 'SM',
        familyHeadId: data.familyHeadId || null,
        mobileNumber: data.mobileNumber ? String(data.mobileNumber).trim() : '',
        verificationStatus: data.verificationStatus || 'Verified',
        isDuplicate: Boolean(data.isDuplicate || (data.duplicateFlags && data.duplicateFlags.length > 0)),
        duplicateFlags: data.duplicateFlags || [],
        isArchived: false,
        dataQualityFlags: [],
        createdAt: now,
        updatedAt: now,
        ...data,
        address: data.address
          ? {
              ...data.address,
              villageWard: (data.address.villageWard || '').trim() || '12',
            }
          : {
              houseNumber: '',
              street: '',
              locality: '',
              villageWard: '12',
              city: 'Patiala',
              district: 'Patiala',
              state: 'Punjab',
              pinCode: '147001',
              country: 'India',
              verified: false,
            },
      };
      memoryStore.voters.set(_id, doc);
      return { ...doc };
    },

    async updateOne(filter, update) {
      if (!isDbInMemory()) {
        return VoterModel.updateOne(filter, update);
      }
      for (const [id, voter] of memoryStore.voters.entries()) {
        if (matchesFilter(voter, filter)) {
          const updateData = { ...(update.$set || update) };
          const updated = {
            ...voter,
            ...updateData,
            updatedAt: new Date(),
          };

          // Support nested dot-notation paths in updateData (e.g. 'communicationConsent.status')
          for (const [k, v] of Object.entries(updateData)) {
            if (k.includes('.')) {
              const parts = k.split('.');
              let target = updated;
              for (let i = 0; i < parts.length - 1; i++) {
                if (!target[parts[i]]) target[parts[i]] = {};
                target[parts[i]] = { ...target[parts[i]] };
                target = target[parts[i]];
              }
              target[parts[parts.length - 1]] = v;
              delete updated[k];
            }
          }

          memoryStore.voters.set(id, updated);
          return { matchedCount: 1, modifiedCount: 1 };
        }
      }
      return { matchedCount: 0, modifiedCount: 0 };
    },

    async query({ filter = {}, sort = { boothSerialNumber: 1 }, skip = 0, limit = 50, search = '', locality = '' }) {
      if (!isDbInMemory()) {
        const andClauses = [];
        if (filter && Object.keys(filter).length > 0) {
          andClauses.push({ ...filter });
        }

        if (locality && locality.trim()) {
          const locRegex = new RegExp(escapeRegex(locality.trim()), 'i');
          andClauses.push({
            $or: [
              { 'address.locality': locRegex },
              { 'address.street': locRegex },
              { 'address.formattedAddress': locRegex },
              { 'address.houseNumber': locRegex },
              { 'address.villageWard': locRegex },
            ],
          });
        }

        if (search) {
          const rawNum = search.replace(/^[#\\]+/, '').trim();
          const cleanNum = Number(rawNum);
          const isNumeric = !isNaN(cleanNum) && cleanNum > 0 && String(cleanNum) === rawNum;
          const regex = new RegExp(escapeRegex(search.trim()), 'i');
          const cleanDigits = search.replace(/\D/g, '');
          const normDigits =
            cleanDigits.length === 12 && cleanDigits.startsWith('91')
              ? cleanDigits.slice(2)
              : cleanDigits.length === 11 && cleanDigits.startsWith('0')
              ? cleanDigits.slice(1)
              : cleanDigits;

          const searchConditions = [
            { fullName: regex },
            { epicNumber: regex },
            { mobileNumber: regex },
            ...(cleanDigits.length >= 3 ? [{ mobileNumber: new RegExp(cleanDigits, 'i') }] : []),
            ...(normDigits.length >= 3 && normDigits !== cleanDigits
              ? [{ mobileNumber: new RegExp(normDigits, 'i') }]
              : []),
            ...(isNumeric ? [{ boothSerialNumber: cleanNum }] : []),
            { relativeName: regex },
            { 'address.city': regex },
            { 'address.locality': regex },
            { 'address.street': regex },
            { 'address.villageWard': regex },
            { 'address.pinCode': regex },
          ];

          // Check if any matching voters are Family Heads (FH)
          const matchingFhList = await VoterModel.find({
            ...filter,
            isArchived: false,
            familyRole: 'FH',
            $or: searchConditions,
          })
            .select('_id')
            .lean();

          if (matchingFhList && matchingFhList.length > 0) {
            const matchingFhIds = matchingFhList.map((doc) => doc._id);
            andClauses.push({
              $or: [
                ...searchConditions,
                { familyRole: 'FM', familyHeadId: { $in: matchingFhIds } },
              ],
            });
          } else {
            andClauses.push({
              $or: searchConditions,
            });
          }
        }

        const queryFilter =
          andClauses.length === 0
            ? {}
            : andClauses.length === 1
            ? andClauses[0]
            : { $and: andClauses };

        const total = await VoterModel.countDocuments(queryFilter);
        const records = await VoterModel.find(queryFilter)
          .populate('pollingStationId')
          .populate('familyHeadId', 'fullName boothSerialNumber epicNumber')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean();
        return { records, total };
      }

      const searchTokens = (search || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
      const normLocality = (locality || '').toLowerCase().trim();
      const matchedMap = new Map();
      const directMatches = [];

      // Check if entire search matches serial number (e.g. "#1" or "1")
      const rawSerialNum = (search || '').replace(/^[#\\]+/, '').trim();
      const entireIsSerial = rawSerialNum && !isNaN(Number(rawSerialNum)) && Number(rawSerialNum) > 0;
      const targetSerial = entireIsSerial ? Number(rawSerialNum) : null;

      // Pass 1: Direct matches
      for (const v of memoryStore.voters.values()) {
        if (!matchesFilter(v, filter)) continue;

        // Locality filter
        if (normLocality) {
          const addr = v.address || {};
          const fullAddr = [
            addr.locality,
            addr.street,
            addr.formattedAddress,
            addr.houseNumber,
            addr.villageWard,
            addr.city,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          if (!fullAddr.includes(normLocality)) continue;
        }

        if (searchTokens.length > 0) {
          const matchesSerial = targetSerial !== null && v.boothSerialNumber === targetSerial;
          const matchesPhoneDirect = phoneMatches(v.mobileNumber, search);

          const matchesTokens = searchTokens.every((token) => {
            const cleanToken = token.replace(/^[#\\]+/, '').trim();
            const tokenNum = cleanToken && !isNaN(Number(cleanToken)) ? Number(cleanToken) : null;
            return (
              (tokenNum !== null && v.boothSerialNumber === tokenNum) ||
              v.fullName?.toLowerCase().includes(token) ||
              v.epicNumber?.toLowerCase().includes(token) ||
              phoneMatches(v.mobileNumber, token) ||
              v.relativeName?.toLowerCase().includes(token) ||
              v.address?.city?.toLowerCase().includes(token) ||
              v.address?.locality?.toLowerCase().includes(token) ||
              v.address?.street?.toLowerCase().includes(token) ||
              v.address?.villageWard?.toLowerCase().includes(token) ||
              v.address?.pinCode?.includes(token)
            );
          });

          if (!matchesSerial && !matchesPhoneDirect && !matchesTokens) continue;
        }
        matchedMap.set(String(v._id || v.id), { ...v });
        directMatches.push(v);
      }

      // Pass 2: If searching, include Family Members (FM) of any matched Family Heads (FH)
      if (searchTokens.length > 0) {
        const matchedFhIds = new Set(
          directMatches
            .filter((v) => v.familyRole === 'FH')
            .map((v) => String(v._id || v.id))
        );

        if (matchedFhIds.size > 0) {
          for (const v of memoryStore.voters.values()) {
            const vId = String(v._id || v.id);
            if (matchedMap.has(vId)) continue;
            // Check non-search filters (e.g. isArchived)
            const nonSearchFilter = { ...filter };
            delete nonSearchFilter.fullName;
            delete nonSearchFilter.epicNumber;
            if (!matchesFilter(v, nonSearchFilter)) continue;

            // Locality filter for correlated FM
            if (normLocality) {
              const addr = v.address || {};
              const fullAddr = [
                addr.locality,
                addr.street,
                addr.formattedAddress,
                addr.houseNumber,
                addr.villageWard,
                addr.city,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

              if (!fullAddr.includes(normLocality)) continue;
            }

            if (v.familyRole === 'FM' && v.familyHeadId && matchedFhIds.has(String(v.familyHeadId))) {
              matchedMap.set(vId, { ...v, matchedViaFamilyHead: true });
            }
          }
        }
      }

      // Populate references
      const all = [];
      for (const item of matchedMap.values()) {
        const populated = { ...item };
        if (populated.pollingStationId && typeof populated.pollingStationId === 'string') {
          populated.pollingStationId =
            memoryStore.pollingStations.get(populated.pollingStationId) || populated.pollingStationId;
        }
        if (populated.familyHeadId && typeof populated.familyHeadId === 'string') {
          const fh = memoryStore.voters.get(populated.familyHeadId);
          if (fh) {
            populated.familyHead = {
              _id: fh._id,
              id: fh._id,
              fullName: fh.fullName,
              boothSerialNumber: fh.boothSerialNumber,
              epicNumber: fh.epicNumber,
            };
          }
        }
        all.push(populated);
      }

      // Sort
      const sortField = Object.keys(sort)[0] || 'boothSerialNumber';
      const sortDir = sort[sortField] === -1 ? -1 : 1;
      all.sort((a, b) => {
        if (sortField === 'boothSerialNumber') {
          const numA = a.boothSerialNumber != null && a.boothSerialNumber !== '' ? Number(a.boothSerialNumber) : 999999999;
          const numB = b.boothSerialNumber != null && b.boothSerialNumber !== '' ? Number(b.boothSerialNumber) : 999999999;
          if (numA !== numB) return (numA - numB) * sortDir;
        } else {
          const valA = a[sortField] || '';
          const valB = b[sortField] || '';
          if (valA < valB) return -1 * sortDir;
          if (valA > valB) return 1 * sortDir;
        }
        // Secondary sort always by serial number ascending
        const serialA = a.boothSerialNumber != null && a.boothSerialNumber !== '' ? Number(a.boothSerialNumber) : 999999999;
        const serialB = b.boothSerialNumber != null && b.boothSerialNumber !== '' ? Number(b.boothSerialNumber) : 999999999;
        return serialA - serialB;
      });

      const total = all.length;
      const records = all.slice(skip, skip + limit);
      return { records, total };
    },

    async getFamilyMembers(headId) {
      if (!isDbInMemory()) {
        return VoterModel.find({ familyHeadId: headId, isArchived: false })
          .populate('pollingStationId')
          .sort({ boothSerialNumber: 1 })
          .lean();
      }
      const list = [];
      for (const v of memoryStore.voters.values()) {
        if (String(v.familyHeadId) === String(headId) && !v.isArchived) {
          const populated = { ...v };
          if (populated.pollingStationId && typeof populated.pollingStationId === 'string') {
            populated.pollingStationId =
              memoryStore.pollingStations.get(populated.pollingStationId) || populated.pollingStationId;
          }
          list.push(populated);
        }
      }
      return list.sort((a, b) => (a.boothSerialNumber || 0) - (b.boothSerialNumber || 0));
    },

    async getFamilyHeads(pollingStationId = null) {
      if (!isDbInMemory()) {
        const query = { familyRole: 'FH', isArchived: false };
        if (pollingStationId) query.pollingStationId = pollingStationId;
        return VoterModel.find(query)
          .select('fullName boothSerialNumber epicNumber pollingStationId familyRole')
          .sort({ boothSerialNumber: 1 })
          .lean();
      }
      const list = [];
      for (const v of memoryStore.voters.values()) {
        if (v.familyRole === 'FH' && !v.isArchived) {
          if (!pollingStationId || String(v.pollingStationId?._id || v.pollingStationId) === String(pollingStationId)) {
            list.push({
              _id: v._id,
              id: v._id,
              fullName: v.fullName,
              boothSerialNumber: v.boothSerialNumber,
              epicNumber: v.epicNumber,
              pollingStationId: v.pollingStationId,
              familyRole: v.familyRole,
            });
          }
        }
      }
      return list.sort((a, b) => (a.boothSerialNumber || 0) - (b.boothSerialNumber || 0));
    },

    async countDocuments(filter = {}) {
      if (!isDbInMemory()) {
        return VoterModel.countDocuments(filter);
      }
      let count = 0;
      for (const v of memoryStore.voters.values()) {
        if (matchesFilter(v, filter)) count++;
      }
      return count;
    },

    async deleteMany(filter = {}) {
      if (!isDbInMemory()) {
        return VoterModel.deleteMany(filter);
      }
      let deletedCount = 0;
      for (const [id, voter] of memoryStore.voters.entries()) {
        if (matchesFilter(voter, filter)) {
          memoryStore.voters.delete(id);
          deletedCount++;
        }
      }
      return { acknowledged: true, deletedCount };
    },

    async deleteOne(filter = {}) {
      if (!isDbInMemory()) {
        return VoterModel.deleteOne(filter);
      }
      for (const [id, voter] of memoryStore.voters.entries()) {
        if (matchesFilter(voter, filter)) {
          memoryStore.voters.delete(id);
          return { acknowledged: true, deletedCount: 1 };
        }
      }
      return { acknowledged: true, deletedCount: 0 };
    },

    async aggregate(pipeline) {
      if (!isDbInMemory()) {
        return VoterModel.aggregate(pipeline);
      }
      // Simple aggregation mock for stats
      return [];
    },
  },

  // PHOTOS
  photos: {
    async findOne(filter) {
      if (!isDbInMemory()) {
        return PrivateVoterPhotoModel.findOne(filter).lean();
      }
      for (const p of memoryStore.photos.values()) {
        if (matchesFilter(p, filter)) return { ...p };
      }
      return null;
    },

    async findByVoterId(voterId) {
      if (!isDbInMemory()) {
        return PrivateVoterPhotoModel.findOne({ voterId, retentionStatus: 'Active' }).lean();
      }
      for (const p of memoryStore.photos.values()) {
        if (String(p.voterId) === String(voterId) && p.retentionStatus === 'Active') {
          return { ...p };
        }
      }
      return null;
    },

    async create(data) {
      if (!isDbInMemory()) {
        const doc = await PrivateVoterPhotoModel.create(data);
        return doc.toObject();
      }
      const _id = generateId();
      const doc = {
        _id,
        id: _id,
        retentionStatus: 'Active',
        uploadedAt: new Date(),
        ...data,
      };
      memoryStore.photos.set(_id, doc);
      return { ...doc };
    },

    async updateOne(filter, update) {
      if (!isDbInMemory()) {
        return PrivateVoterPhotoModel.updateOne(filter, update);
      }
      for (const [id, photo] of memoryStore.photos.entries()) {
        if (matchesFilter(photo, filter)) {
          const updateData = update.$set || update;
          memoryStore.photos.set(id, { ...photo, ...updateData, updatedAt: new Date() });
          return { matchedCount: 1, modifiedCount: 1 };
        }
      }
      return { matchedCount: 0, modifiedCount: 0 };
    },
  },

  // AUDIT LOGS
  auditLogs: {
    async create(data) {
      if (!isDbInMemory()) {
        const doc = await AuditLogModel.create(data);
        return doc.toObject();
      }
      const _id = generateId();
      const doc = {
        _id,
        id: _id,
        timestamp: new Date(),
        ...data,
      };
      memoryStore.auditLogs.unshift(doc);
      return { ...doc };
    },

    async getLastRecord() {
      if (!isDbInMemory()) {
        return AuditLogModel.findOne().sort({ timestamp: -1 }).lean();
      }
      return memoryStore.auditLogs[0] || null;
    },

    async query({ filter = {}, skip = 0, limit = 50 }) {
      if (!isDbInMemory()) {
        const total = await AuditLogModel.countDocuments(filter);
        const logs = await AuditLogModel.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean();
        return { logs, total };
      }
      const filtered = memoryStore.auditLogs.filter((l) => matchesFilter(l, filter));
      return {
        logs: filtered.slice(skip, skip + limit),
        total: filtered.length,
      };
    },
  },

  // SECURITY EVENTS
  securityEvents: {
    async create(data) {
      if (!isDbInMemory()) {
        const doc = await SecurityEventModel.create(data);
        return doc.toObject();
      }
      const _id = generateId();
      const doc = {
        _id,
        id: _id,
        resolved: false,
        createdAt: new Date(),
        ...data,
      };
      memoryStore.securityEvents.unshift(doc);
      return { ...doc };
    },

    async query({ filter = {}, limit = 50 }) {
      if (!isDbInMemory()) {
        return SecurityEventModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
      }
      const filtered = memoryStore.securityEvents.filter((e) => matchesFilter(e, filter));
      return filtered.slice(0, limit);
    },

    async updateOne(filter, update) {
      if (!isDbInMemory()) {
        return SecurityEventModel.updateOne(filter, update);
      }
      for (let i = 0; i < memoryStore.securityEvents.length; i++) {
        if (matchesFilter(memoryStore.securityEvents[i], filter)) {
          memoryStore.securityEvents[i] = {
            ...memoryStore.securityEvents[i],
            ...(update.$set || update),
          };
          return { matchedCount: 1, modifiedCount: 1 };
        }
      }
      return { matchedCount: 0, modifiedCount: 0 };
    },
  },

  // GOVERNANCE
  governance: {
    async getPolicy() {
      if (!isDbInMemory()) {
        let policy = await DataGovernanceModel.findOne().lean();
        if (!policy) {
          policy = await DataGovernanceModel.create({ policyName: 'Default ElectionDesk DPDP Policy' });
          policy = policy.toObject();
        }
        return policy;
      }
      let policy = memoryStore.governance.get('default');
      if (!policy) {
        policy = {
          _id: generateId(),
          policyName: 'Default ElectionDesk DPDP Policy',
          retentionDays: 1825,
          archivedPurgeDays: 90,
          dpdpCompliant: true,
          dpdpNoticeVersion: 'v2026.1',
          anonymizeExports: true,
          lawfulBasis: 'Statutory mandate under Electoral Law & DPDP Act 2023',
          dataProtectionOfficer: {
            name: 'Chief Electoral Data Protection Officer',
            email: 'dpo@electiondesk.gov',
          },
          updatedAt: new Date(),
        };
        memoryStore.governance.set('default', policy);
      }
      return { ...policy };
    },

    async updatePolicy(data) {
      if (!isDbInMemory()) {
        return DataGovernanceModel.findOneAndUpdate({}, { $set: data }, { new: true, upsert: true }).lean();
      }
      const current = await this.getPolicy();
      const updated = { ...current, ...data, updatedAt: new Date() };
      memoryStore.governance.set('default', updated);
      return updated;
    },
  },

  // COMMUNICATION LOGS
  communicationLogs: {
    async create(data) {
      if (!isDbInMemory()) {
        const doc = await CommunicationLogModel.create(data);
        return doc.toObject();
      }
      const _id = generateId();
      const doc = {
        _id,
        id: _id,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      memoryStore.communicationLogs.unshift(doc);
      return { ...doc };
    },

    async findById(id) {
      if (!isDbInMemory()) {
        return CommunicationLogModel.findById(id).lean();
      }
      return memoryStore.communicationLogs.find((l) => (l._id === id || l.id === id)) || null;
    },

    async findOne(filter = {}) {
      if (!isDbInMemory()) {
        return CommunicationLogModel.findOne(filter).lean();
      }
      return memoryStore.communicationLogs.find((l) => matchesFilter(l, filter)) || null;
    },

    async find(filter = {}) {
      if (!isDbInMemory()) {
        return CommunicationLogModel.find(filter).sort({ createdAt: -1 }).lean();
      }
      return memoryStore.communicationLogs.filter((l) => matchesFilter(l, filter));
    },

    async query({ filter = {}, skip = 0, limit = 50 }) {
      if (!isDbInMemory()) {
        const total = await CommunicationLogModel.countDocuments(filter);
        const logs = await CommunicationLogModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();
        return { logs, total };
      }
      const filtered = memoryStore.communicationLogs.filter((l) => matchesFilter(l, filter));
      return {
        logs: filtered.slice(skip, skip + limit),
        total: filtered.length,
      };
    },

    async updateOne(filter, update) {
      if (!isDbInMemory()) {
        return CommunicationLogModel.updateOne(filter, update);
      }
      for (let i = 0; i < memoryStore.communicationLogs.length; i++) {
        if (matchesFilter(memoryStore.communicationLogs[i], filter)) {
          memoryStore.communicationLogs[i] = {
            ...memoryStore.communicationLogs[i],
            ...(update.$set || update),
            updatedAt: new Date(),
          };
          return { matchedCount: 1, modifiedCount: 1 };
        }
      }
      return { matchedCount: 0, modifiedCount: 0 };
    },

    async countDocuments(filter = {}) {
      if (!isDbInMemory()) {
        return CommunicationLogModel.countDocuments(filter);
      }
      return memoryStore.communicationLogs.filter((l) => matchesFilter(l, filter)).length;
    },
  },
};
