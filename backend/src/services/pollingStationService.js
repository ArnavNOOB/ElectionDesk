import { dbStore } from './store.js';
import { logAuditEvent } from './auditService.js';
import { escapeRegex } from '../utils/sanitize.js';

export async function listPollingStations({ search = '', assemblyConstituency, status, limit = 100 }) {
  const filter = {};
  if (status) filter.status = status;
  if (assemblyConstituency) filter.assemblyConstituency = assemblyConstituency;

  const booths = await dbStore.pollingStations.find(filter);

  if (search) {
    const q = search.toLowerCase();
    return booths.filter(
      (b) =>
        String(b.officialBoothNumber || '').toLowerCase().includes(q) ||
        (b.stationName && String(b.stationName).toLowerCase().includes(q)) ||
        (b.electoralArea && String(b.electoralArea).toLowerCase().includes(q))
    );
  }

  return booths;
}

export async function getPollingStationById(id) {
  return dbStore.pollingStations.findById(id);
}

export async function createPollingStation(data, actor, reqMeta = {}) {
  const existing = await dbStore.pollingStations.findOne({
    officialBoothNumber: data.officialBoothNumber.trim(),
  });
  if (existing) {
    throw new Error(`Polling station with Booth #${data.officialBoothNumber} already exists`);
  }

  const booth = await dbStore.pollingStations.create({
    ...data,
    officialBoothNumber: data.officialBoothNumber.trim(),
    lastVerifiedAt: new Date(),
  });

  await logAuditEvent({
    actor,
    action: 'BOOTH_CREATE',
    entityType: 'POLLING_STATION',
    entityId: booth._id || booth.id,
    outcome: 'SUCCESS',
    ipAddress: reqMeta.ipAddress || '127.0.0.1',
    userAgent: reqMeta.userAgent || '',
    details: { boothNumber: booth.officialBoothNumber, stationName: booth.stationName },
  });

  return booth;
}

export async function updatePollingStation(id, updateData, actor, reqMeta = {}) {
  const existing = await dbStore.pollingStations.findById(id);
  if (!existing) throw new Error('Polling station not found');

  await dbStore.pollingStations.updateOne(
    { _id: id },
    { $set: { ...updateData, lastVerifiedAt: new Date() } }
  );

  await logAuditEvent({
    actor,
    action: 'BOOTH_UPDATE',
    entityType: 'POLLING_STATION',
    entityId: id,
    outcome: 'SUCCESS',
    ipAddress: reqMeta.ipAddress || '127.0.0.1',
    userAgent: reqMeta.userAgent || '',
    details: { boothNumber: existing.officialBoothNumber },
  });

  return dbStore.pollingStations.findById(id);
}

export async function getBoothSummaryMetrics() {
  const booths = await dbStore.pollingStations.find();
  const totalBooths = booths.length;
  const activeBooths = booths.filter((b) => b.status === 'Active').length;
  const totalAssignedVoters = booths.reduce((acc, b) => acc + (b.voterCount || 0), 0);
  const averageVotersPerBooth = totalBooths > 0 ? Math.round(totalAssignedVoters / totalBooths) : 0;

  return {
    totalBooths,
    activeBooths,
    totalAssignedVoters,
    averageVotersPerBooth,
    booths: booths.map((b) => ({
      id: b._id || b.id,
      officialBoothNumber: b.officialBoothNumber,
      stationName: b.stationName,
      assemblyConstituency: b.assemblyConstituency,
      voterCount: b.voterCount || 0,
      status: b.status,
    })),
  };
}
