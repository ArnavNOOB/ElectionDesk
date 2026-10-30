#!/usr/bin/env node

/**
 * ElectionDesk - Seed & Demo Data Cleanup Utility
 * 
 * Safely removes synthetic demonstration voters, sample polling booths,
 * and demo users from MongoDB Atlas or local MongoDB while preserving custom admin accounts.
 * 
 * Usage:
 *   node scripts/clearSeedData.js             # Removes synthetic demo records
 *   node scripts/clearSeedData.js --all       # Clears all voters and booths (complete roll wipe)
 */

import { connectDB, disconnectDB } from '../src/config/db.js';
import { dbStore } from '../src/services/store.js';
import { logger } from '../src/utils/logger.js';

export async function clearSeedData(wipeAll = false) {
  await connectDB();

  logger.info(`[ClearSeed] Connecting to database to purge seed data (wipeAll=${wipeAll})...`);

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
  if (wipeAll) {
    const res = await dbStore.voters.deleteMany({});
    deletedVoters = res.deletedCount || 0;
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
  if (wipeAll) {
    const res = await dbStore.pollingStations.deleteMany({});
    deletedBooths = res.deletedCount || 0;
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
  for (const email of defaultSyntheticUsers) {
    const u = await dbStore.users.findOne({ email });
    if (u) {
      await dbStore.users.deleteOne({ _id: u._id || u.id });
      deletedUsers++;
    }
  }

  // Recalculate remaining booth counts
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

  logger.info(`[ClearSeed] Finished: Deleted ${deletedVoters} voters, ${deletedBooths} booths, ${deletedUsers} demo users.`);
  return { deletedVoters, deletedBooths, deletedUsers };
}

if (process.argv[1]?.includes('clearSeedData.js')) {
  const wipeAll = process.argv.includes('--all');
  clearSeedData(wipeAll)
    .then(async (res) => {
      console.log(`\nSuccess: Removed ${res.deletedVoters} voters, ${res.deletedBooths} booths, and ${res.deletedUsers} demo users.`);
      await disconnectDB();
      process.exit(0);
    })
    .catch((err) => {
      console.error('\nFailed to clear seed data:', err);
      process.exit(1);
    });
}
