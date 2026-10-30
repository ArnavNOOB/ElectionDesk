import { dbStore } from '../services/store.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { logAuditEvent } from '../services/auditService.js';

export async function handleGetGovernancePolicy(req, res, next) {
  try {
    const policy = await dbStore.governance.getPolicy();
    return ApiResponse.success(res, policy, 'Data governance policy retrieved');
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateGovernancePolicy(req, res, next) {
  try {
    const updated = await dbStore.governance.updatePolicy(req.body);
    await logAuditEvent({
      actor: req.user,
      action: 'POLICY_UPDATE',
      entityType: 'SYSTEM',
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      details: { policyName: updated.policyName },
    });
    return ApiResponse.success(res, updated, 'Data governance policy updated');
  } catch (error) {
    next(error);
  }
}

export async function handleRunRetentionPurge(req, res, next) {
  try {
    const policy = await dbStore.governance.getPolicy();
    const purgeThreshold = new Date(Date.now() - (policy.archivedPurgeDays || 90) * 24 * 60 * 60 * 1000);

    const { records: archived } = await dbStore.voters.query({ filter: { isArchived: true }, limit: 1000 });
    let purgedCount = 0;

    for (const v of archived) {
      if (v.archivedAt && new Date(v.archivedAt) <= purgeThreshold) {
        // Permanently purge record
        await dbStore.voters.updateOne({ _id: v._id || v.id }, { $set: { isPurged: true } });
        purgedCount++;
      }
    }

    await logAuditEvent({
      actor: req.user,
      action: 'RETENTION_PURGE',
      entityType: 'SYSTEM',
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      details: { purgedCount, thresholdDays: policy.archivedPurgeDays },
    });

    return ApiResponse.success(res, { purgedCount }, `Retention policy applied. ${purgedCount} archived records purged.`);
  } catch (error) {
    next(error);
  }
}


export async function handleClearSeedData(req, res, next) {
  try {
    const defaultSyntheticEpics = [
      'PB9182341', 'PB9182342', 'BLR3910294', 'PB8492014', 'BLR9991201', 'PB3910295',
      'BLR1049281', 'BLR1049282', 'BLR2093841', 'DEL5892014', 'BLR4420193', 'BLR7748201',
      'PB1049281', 'PB1049282', 'PB2093842'
    ];
    const defaultSyntheticBooths = ['42', '43', '44', '45', '46', '142-A', '142-B', '155-A'];
    const defaultSyntheticUsers = [
      'superadmin@electiondesk.gov',
      'dataadmin@electiondesk.gov',
      'operator@electiondesk.gov',
      'auditor@electiondesk.gov',
      'readonly@electiondesk.gov',
    ];

    let deletedVoters = 0;
    if (req.body?.purgeAllVoters) {
      const result = await dbStore.voters.deleteMany({});
      deletedVoters = result.deletedCount || 0;
    } else {
      for (const epic of defaultSyntheticEpics) {
        const v = await dbStore.voters.findOne({ epicNumber: epic });
        if (v) {
          await dbStore.voters.deleteOne({ _id: v._id || v.id });
          deletedVoters++;
        }
      }
      const demoNames = [
        'Harpreet Singh Sandhu', 'Jasleen Kaur Sandhu', 'Deepika Narayanan',
        'Gurkirat Singh Dhillon', 'Vikramaditya Rao', 'Simranjit Kaur Mann',
        'Sneha Meenakshi Sundaram', 'Aarav Rajesh Patel', 'Ananya Aarav Patel',
        'Rohan Mehra', 'Karthik Subbaraj'
      ];
      for (const name of demoNames) {
        const v = await dbStore.voters.findOne({ fullName: name });
        if (v) {
          await dbStore.voters.deleteOne({ _id: v._id || v.id });
          deletedVoters++;
        }
      }
    }

    let deletedBooths = 0;
    if (req.body?.purgeAllBooths) {
      const result = await dbStore.pollingStations.deleteMany({});
      deletedBooths = result.deletedCount || 0;
    } else {
      for (const bNum of defaultSyntheticBooths) {
        const booth = await dbStore.pollingStations.findOne({ officialBoothNumber: bNum });
        if (booth) {
          await dbStore.pollingStations.deleteOne({ _id: booth._id || booth.id });
          deletedBooths++;
        }
      }
    }

    let deletedUsers = 0;
    const currentUserId = req.user?._id || req.user?.id;
    for (const email of defaultSyntheticUsers) {
      const u = await dbStore.users.findOne({ email });
      if (u && String(u._id || u.id) !== String(currentUserId)) {
        await dbStore.users.deleteOne({ _id: u._id || u.id });
        deletedUsers++;
      }
    }

    // Recalculate voter counts on remaining polling booths
    const remainingBooths = await dbStore.pollingStations.find();
    for (const b of remainingBooths) {
      const count = await dbStore.voters.countDocuments({
        pollingStationId: b._id || b.id,
        isArchived: false,
      });
      await dbStore.pollingStations.updateOne(
        { _id: b._id || b.id },
        { $set: { voterCount: count } }
      );
    }

    await logAuditEvent({
      actor: req.user,
      action: 'CLEAR_SEED_DATA',
      entityType: 'SYSTEM',
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      details: { deletedVoters, deletedBooths, deletedUsers },
    });

    return ApiResponse.success(res, { deletedVoters, deletedBooths, deletedUsers },
      `Seed data removed successfully: ${deletedVoters} voters, ${deletedBooths} polling stations, and ${deletedUsers} demo accounts.`);
  } catch (error) {
    next(error);
  }
}
