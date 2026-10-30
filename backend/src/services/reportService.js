import { dbStore } from './store.js';

export async function getDashboardOverviewMetrics() {
  const { records: allVoters, total: totalVoters } = await dbStore.voters.query({
    filter: { isArchived: false },
    limit: 10000,
  });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let addedLast7Days = 0;
  let updatedLast7Days = 0;
  let pendingVerification = 0;
  let flaggedDuplicates = 0;
  let duplicateSerialCount = 0;
  let duplicateEpicCount = 0;
  let verifiedCount = 0;

  const genderDistribution = { Male: 0, Female: 0, 'Third Gender': 0 };
  const ageBrackets = { '18-25': 0, '26-35': 0, '36-50': 0, '51-65': 0, '65+': 0 };
  const qualityIssues = {
    missingPin: 0,
    unverifiedAddress: 0,
    unassignedBooth: 0,
    incompleteAddress: 0,
  };

  for (const v of allVoters) {
    const createdAt = new Date(v.createdAt || now);
    const updatedAt = new Date(v.updatedAt || now);

    if (createdAt >= sevenDaysAgo) addedLast7Days++;
    if (updatedAt >= sevenDaysAgo && updatedAt > createdAt) updatedLast7Days++;

    const isDupSerial =
      v.duplicateFlags?.includes('DUPLICATE_SERIAL_ID') ||
      v.dataQualityFlags?.includes('DUPLICATE_SERIAL_ID');
    const isDupEpic =
      v.duplicateFlags?.includes('DUPLICATE_EPIC_NUMBER') ||
      v.dataQualityFlags?.includes('DUPLICATE_EPIC_NUMBER');
    const isAnyDup =
      v.isDuplicate ||
      isDupSerial ||
      isDupEpic ||
      v.dataQualityFlags?.includes('POTENTIAL_DUPLICATE_DETECTED') ||
      v.verificationStatus === 'Flagged_Duplicate';

    if (isDupSerial) duplicateSerialCount++;
    if (isDupEpic) duplicateEpicCount++;
    if (isAnyDup) flaggedDuplicates++;
    else verifiedCount++;

    if (v.gender && genderDistribution[v.gender] !== undefined) {
      genderDistribution[v.gender]++;
    }

    const age = v.age;
    if (age >= 18 && age <= 25) ageBrackets['18-25']++;
    else if (age >= 26 && age <= 35) ageBrackets['26-35']++;
    else if (age >= 36 && age <= 50) ageBrackets['36-50']++;
    else if (age >= 51 && age <= 65) ageBrackets['51-65']++;
    else if (age > 65) ageBrackets['65+']++;

    if (v.dataQualityFlags && Array.isArray(v.dataQualityFlags)) {
      if (v.dataQualityFlags.includes('INVALID_OR_MISSING_PIN')) qualityIssues.missingPin++;
      if (v.dataQualityFlags.includes('UNVERIFIED_ADDRESS')) qualityIssues.unverifiedAddress++;
      if (v.dataQualityFlags.includes('UNASSIGNED_POLLING_BOOTH')) qualityIssues.unassignedBooth++;
      if (v.dataQualityFlags.includes('INCOMPLETE_RESIDENTIAL_ADDRESS')) qualityIssues.incompleteAddress++;
    }
  }

  const totalBooths = await dbStore.pollingStations.countDocuments();
  const securityEvents = await dbStore.securityEvents.query({ filter: { resolved: false }, limit: 10 });
  const recentAudit = await dbStore.auditLogs.query({ filter: {}, limit: 10 });

  return {
    totalRecords: totalVoters,
    addedLast7Days,
    updatedLast7Days,
    pendingVerification,
    flaggedDuplicates,
    duplicateSerialCount,
    duplicateEpicCount,
    verifiedCount,
    totalBooths,
    genderDistribution,
    ageBrackets,
    qualityIssues,
    unresolvedSecurityAlerts: securityEvents.length,
    recentActivity: recentAudit.logs,
  };
}
