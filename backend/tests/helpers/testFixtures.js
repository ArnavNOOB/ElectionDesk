import { connectDB } from '../../src/config/db.js';
import { dbStore } from '../../src/services/store.js';
import { hashPassword } from '../../src/utils/crypto.js';
import { UserRole } from '../../src/models/User.js';
import { logAuditEvent } from '../../src/services/auditService.js';
import { evaluateDataQuality } from '../../src/services/voterService.js';
import { logger } from '../../src/utils/logger.js';

/**
 * Test fixture setup utility for Vitest test suites.
 * Exclusively used by automated test runner to initialize isolated in-memory test fixtures.
 */
export async function setupTestFixtures(options = {}) {
  await connectDB();
  const shouldSeedVoters =
    options.seedVoters === true ||
    (options.seedVoters === undefined && (process.env.NODE_ENV === 'test' || process.env.SEED_DEFAULT_VOTERS === 'true'));

  logger.info(`Initializing Test Fixtures (seedVoters=${shouldSeedVoters})...`);

  // 1. Test Roles & Users
  const defaultUsers = [
    {
      email: 'superadmin@electiondesk.gov',
      fullName: 'Chief Election Commissioner Admin',
      role: UserRole.SUPER_ADMIN,
      password: 'SuperAdmin@2026!',
    },
    {
      email: 'dataadmin@electiondesk.gov',
      fullName: 'Priya Sharma (Data Administrator)',
      role: UserRole.DATA_ADMIN,
      password: 'DataAdmin@2026!',
    },
    {
      email: 'operator@electiondesk.gov',
      fullName: 'Rahul Verma (Data Entry Operator)',
      role: UserRole.DATA_ENTRY_OPERATOR,
      password: 'Operator@2026!',
    },
    {
      email: 'auditor@electiondesk.gov',
      fullName: 'Kavita Sundaram (Chief Oversight Auditor)',
      role: UserRole.AUDITOR,
      password: 'Auditor@2026!',
    },
    {
      email: 'readonly@electiondesk.gov',
      fullName: 'Observer Ramesh (Read-only Observer)',
      role: UserRole.READ_ONLY,
      password: 'ReadOnly@2026!',
    },
  ];

  const seededUsers = [];
  for (const u of defaultUsers) {
    let existing = await dbStore.users.findOne({ email: u.email });
    if (!existing) {
      const passwordHash = await hashPassword(u.password);
      existing = await dbStore.users.create({
        email: u.email,
        fullName: u.fullName,
        role: u.role,
        passwordHash,
        isActive: true,
      });
      logger.info(`Seeded User [${u.role}]: ${u.email}`);
    }
    seededUsers.push(existing);
  }

  const superAdmin = seededUsers[0];

  // 2. Test Polling Stations (booths 42, 43, 44, 45, 46 in Ward 12)
  const defaultBooths = [
    {
      officialBoothNumber: '42',
      stationName: 'Government Multipurpose Senior Secondary School, Room 1',
      electoralArea: 'Ward 12',
      assemblyConstituency: '115 - Patiala Urban',
      parliamentaryConstituency: '13 - Patiala',
      district: 'Patiala',
      address: 'Passi Road, Near Model Town, Patiala, Punjab 147001',
      location: { latitude: 30.3256, longitude: 76.3982 },
      sourceReference: 'Punjab State Election Commission 2026',
      status: 'Active',
    },
    {
      officialBoothNumber: '43',
      stationName: 'Government Mohindra College, Science Block Hall',
      electoralArea: 'Ward 12',
      assemblyConstituency: '115 - Patiala Urban',
      parliamentaryConstituency: '13 - Patiala',
      district: 'Patiala',
      address: 'Lower Mall Road, Near Leela Bhawan, Patiala, Punjab 147001',
      location: { latitude: 30.3398, longitude: 76.3869 },
      sourceReference: 'Punjab State Election Commission 2026',
      status: 'Active',
    },
    {
      officialBoothNumber: '44',
      stationName: 'University Senior Secondary Model School, Main Auditorium',
      electoralArea: 'Ward 12',
      assemblyConstituency: '115 - Patiala Urban',
      parliamentaryConstituency: '13 - Patiala',
      district: 'Patiala',
      address: 'Punjabi University Campus, Urban Estate Phase 2, Patiala, Punjab 147002',
      location: { latitude: 30.3541, longitude: 76.4422 },
      sourceReference: 'Punjab State Election Commission 2026',
      status: 'Active',
    },
    {
      officialBoothNumber: '45',
      stationName: 'Community Welfare Center, Top Khana Gate',
      electoralArea: 'Ward 12',
      assemblyConstituency: '115 - Patiala Urban',
      parliamentaryConstituency: '13 - Patiala',
      district: 'Patiala',
      address: 'Top Khana Road, Near Heritage Street, Patiala, Punjab 147001',
      location: { latitude: 30.3312, longitude: 76.4015 },
      sourceReference: 'Punjab State Election Commission 2026',
      status: 'Active',
    },
    {
      officialBoothNumber: '46',
      stationName: 'Government Girls Senior Secondary School, Old Police Lines',
      electoralArea: 'Ward 12',
      assemblyConstituency: '115 - Patiala Urban',
      parliamentaryConstituency: '13 - Patiala',
      district: 'Patiala',
      address: 'Old Police Lines, Near Fountain Chowk, Patiala, Punjab 147001',
      location: { latitude: 30.3385, longitude: 76.3921 },
      sourceReference: 'Punjab State Election Commission 2026',
      status: 'Active',
    },
  ];

  const seededBooths = [];
  for (const b of defaultBooths) {
    let existing = await dbStore.pollingStations.findOne({
      officialBoothNumber: b.officialBoothNumber,
      assemblyConstituency: b.assemblyConstituency,
    });
    if (!existing) {
      existing = await dbStore.pollingStations.create(b);
      logger.info(`Seeded Polling Station: ${b.officialBoothNumber} - ${b.stationName}`);
    }
    seededBooths.push(existing);
  }

  // 3. Test Synthetic Voter Records (DPDP Compliant)
  const syntheticVoters = [
    {
      boothSerialNumber: 1,
      epicNumber: 'PB1049281',
      fullName: 'Harpreet Singh Sandhu',
      relativeName: 'Jagjit Singh Sandhu',
      relationType: 'Father',
      familyRole: 'FH',
      mobileNumber: '9814012345',
      gender: 'Male',
      age: 38,
      address: {
        houseNumber: '142-A',
        street: 'Model Town Main Road',
        locality: 'Model Town',
        villageWard: '12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147001',
        country: 'India',
        formattedAddress: '142-A, Model Town Main Road, Patiala, Punjab 147001',
        verified: true,
        lastVerifiedAt: new Date(),
      },
      pollingStationId: seededBooths[0]._id || seededBooths[0].id,
      verificationStatus: 'Verified',
    },
    {
      boothSerialNumber: 2,
      epicNumber: 'PB1049282',
      fullName: 'Jasleen Kaur Sandhu',
      relativeName: 'Harpreet Singh Sandhu',
      relationType: 'Husband',
      familyRole: 'FM',
      familyHeadRef: 'PB1049281',
      mobileNumber: '9814012346',
      gender: 'Female',
      age: 35,
      address: {
        houseNumber: '142-A',
        street: 'Model Town Main Road',
        locality: 'Model Town',
        villageWard: '12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147001',
        country: 'India',
        formattedAddress: '142-A, Model Town Main Road, Patiala, Punjab 147001',
        verified: true,
        lastVerifiedAt: new Date(),
      },
      pollingStationId: seededBooths[0]._id || seededBooths[0].id,
      verificationStatus: 'Verified',
    },
    {
      boothSerialNumber: 3,
      epicNumber: 'BLR4420193',
      fullName: 'Deepika Narayanan',
      relativeName: 'M. Narayanan',
      relationType: 'Father',
      familyRole: 'SM',
      gender: 'Female',
      age: 26,
      address: {
        houseNumber: '108',
        street: 'Indiranagar 100ft Road',
        locality: 'Indiranagar',
        villageWard: '12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147001',
        country: 'India',
        formattedAddress: '108, Indiranagar, Patiala, Punjab 147001',
        verified: true,
        lastVerifiedAt: new Date(),
      },
      pollingStationId: seededBooths[0]._id || seededBooths[0].id,
      verificationStatus: 'Verified',
    },
    {
      boothSerialNumber: 1,
      epicNumber: 'PB2093842',
      fullName: 'Gurkirat Singh Dhillon',
      relativeName: 'Mohinder Singh Dhillon',
      relationType: 'Father',
      familyRole: 'SM',
      mobileNumber: '9872054321',
      gender: 'Male',
      age: 42,
      address: {
        houseNumber: '55',
        street: 'Leela Bhawan Commercial Belt',
        locality: 'Leela Bhawan',
        villageWard: '12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147001',
        country: 'India',
        formattedAddress: '55, Leela Bhawan, Patiala, Punjab 147001',
        verified: true,
        lastVerifiedAt: new Date(),
      },
      pollingStationId: seededBooths[1]._id || seededBooths[1].id,
      verificationStatus: 'Verified',
    },
    {
      boothSerialNumber: 2,
      epicNumber: 'DEL5892014',
      fullName: 'Vikramaditya Rao',
      relativeName: 'Suresh Rao',
      relationType: 'Father',
      familyRole: 'SM',
      gender: 'Male',
      age: 51,
      address: {
        houseNumber: '12/4',
        street: 'Baradari Lane',
        locality: 'Civil Lines',
        villageWard: '12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147001',
        country: 'India',
        formattedAddress: '12/4, Baradari Lane, Civil Lines, Patiala, Punjab 147001',
        verified: false,
        lastVerifiedAt: null,
      },
      pollingStationId: seededBooths[1]._id || seededBooths[1].id,
      verificationStatus: 'Verified',
      isDuplicate: true,
      duplicateFlags: ['DUPLICATE_SERIAL_ID'],
      dataQualityFlags: ['DUPLICATE_SERIAL_ID'],
    },
    {
      boothSerialNumber: 1,
      epicNumber: 'PB3910295',
      fullName: 'Simranjit Kaur Mann',
      relativeName: 'Harcharan Singh Mann',
      relationType: 'Father',
      familyRole: 'SM',
      mobileNumber: '9876543210',
      gender: 'Female',
      age: 29,
      address: {
        houseNumber: '302',
        street: 'Sector 3 Road',
        locality: 'Urban Estate Phase 2',
        villageWard: '12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147002',
        country: 'India',
        formattedAddress: '302, Urban Estate Phase 2, Patiala, Punjab 147002',
        verified: true,
        lastVerifiedAt: new Date(),
      },
      pollingStationId: seededBooths[2]._id || seededBooths[2].id,
      verificationStatus: 'Verified',
    },
    {
      boothSerialNumber: 2,
      epicNumber: 'BLR7748201',
      fullName: 'Sneha Meenakshi Sundaram',
      relativeName: 'K. Sundaram',
      relationType: 'Father',
      familyRole: 'SM',
      gender: 'Female',
      age: 31,
      address: {
        houseNumber: '401-B',
        street: 'Rajpura Road Ext',
        locality: 'Urban Estate Phase 1',
        villageWard: '12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147002',
        country: 'India',
        formattedAddress: '401-B, Urban Estate Phase 1, Patiala, Punjab 147002',
        verified: true,
        lastVerifiedAt: new Date(),
      },
      pollingStationId: seededBooths[2]._id || seededBooths[2].id,
      verificationStatus: 'Verified',
    },
    {
      boothSerialNumber: 1,
      epicNumber: 'BLR1049281',
      fullName: 'Aarav Rajesh Patel',
      relativeName: 'Rajesh Patel',
      relationType: 'Father',
      familyRole: 'FH',
      mobileNumber: '9845012345',
      gender: 'Male',
      age: 41,
      address: {
        houseNumber: '42',
        street: 'Passi Road',
        locality: 'Model Town',
        villageWard: '12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147001',
        country: 'India',
        formattedAddress: '42, Passi Road, Model Town, Patiala, Punjab 147001',
        verified: true,
        lastVerifiedAt: new Date(),
      },
      pollingStationId: seededBooths[3]._id || seededBooths[3].id,
      verificationStatus: 'Verified',
    },
    {
      boothSerialNumber: 2,
      epicNumber: 'BLR1049282',
      fullName: 'Ananya Aarav Patel',
      relativeName: 'Aarav Rajesh Patel',
      relationType: 'Husband',
      familyRole: 'FM',
      familyHeadRef: 'BLR1049281',
      mobileNumber: '9845012346',
      gender: 'Female',
      age: 38,
      address: {
        houseNumber: '42',
        street: 'Passi Road',
        locality: 'Model Town',
        villageWard: '12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147001',
        country: 'India',
        formattedAddress: '42, Passi Road, Model Town, Patiala, Punjab 147001',
        verified: true,
        lastVerifiedAt: new Date(),
      },
      pollingStationId: seededBooths[3]._id || seededBooths[3].id,
      verificationStatus: 'Verified',
    },
    {
      boothSerialNumber: 1,
      epicNumber: 'BLR2093841',
      fullName: 'Rohan Mehra',
      relativeName: 'Vikram Mehra',
      relationType: 'Father',
      familyRole: 'SM',
      gender: 'Male',
      age: 24,
      address: {
        houseNumber: '15/A',
        street: 'Mall Road',
        locality: 'Baradari Gardens',
        villageWard: '12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147001',
        country: 'India',
        formattedAddress: '15/A, Mall Road, Baradari Gardens, Patiala, Punjab 147001',
        verified: false,
        lastVerifiedAt: null,
      },
      pollingStationId: seededBooths[4]._id || seededBooths[4].id,
      verificationStatus: 'Verified',
    },
    {
      boothSerialNumber: 99,
      epicNumber: 'BLR9991201',
      fullName: 'Rohan Mehra',
      relativeName: 'Vikram Mehra',
      relationType: 'Father',
      familyRole: 'SM',
      gender: 'Male',
      age: 24,
      address: {
        houseNumber: '15/A',
        street: 'Mall Road',
        locality: 'Baradari Gardens',
        villageWard: '12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147001',
        country: 'India',
        formattedAddress: '15/A, Mall Road, Baradari Gardens, Patiala, Punjab 147001',
        verified: false,
        lastVerifiedAt: null,
      },
      pollingStationId: seededBooths[4]._id || seededBooths[4].id,
      verificationStatus: 'Verified',
      isDuplicate: true,
      duplicateFlags: ['DUPLICATE_EPIC_NUMBER'],
      dataQualityFlags: ['DUPLICATE_EPIC_NUMBER'],
    },
    {
      boothSerialNumber: 1,
      epicNumber: 'BLR3910294',
      fullName: 'Karthik Subbaraj',
      relativeName: 'Subbaraj K',
      relationType: 'Father',
      familyRole: 'SM',
      gender: 'Male',
      age: 33,
      address: {
        houseNumber: '88',
        street: 'Tripuri Main Bazar',
        locality: 'Tripuri Town',
        villageWard: '12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147001',
        country: 'India',
        formattedAddress: '88, Tripuri Main Bazar, Patiala, Punjab 147001',
        verified: false,
        lastVerifiedAt: null,
      },
      pollingStationId: seededBooths[0]._id || seededBooths[0].id,
      verificationStatus: 'Verified',
      isDuplicate: true,
      duplicateFlags: ['DUPLICATE_SERIAL_ID'],
      dataQualityFlags: ['DUPLICATE_SERIAL_ID'],
    },
  ];

  const defaultSyntheticEpics = syntheticVoters.map((v) => v.epicNumber).filter(Boolean);

  if (shouldSeedVoters) {
    const voterMap = new Map();
    for (const v of syntheticVoters) {
      const { familyHeadRef, ...cleanVoter } = v;
      let existing = await dbStore.voters.findOne(
        cleanVoter.epicNumber
          ? { epicNumber: cleanVoter.epicNumber }
          : { fullName: cleanVoter.fullName, relativeName: cleanVoter.relativeName }
      );
      if (!existing) {
        let familyHeadId = null;
        if (cleanVoter.familyRole === 'FM' && familyHeadRef && voterMap.has(familyHeadRef)) {
          familyHeadId = voterMap.get(familyHeadRef);
        }
        const dataQualityFlags = evaluateDataQuality({ ...cleanVoter, familyHeadId });
        existing = await dbStore.voters.create({
          ...cleanVoter,
          familyRole: cleanVoter.familyRole || 'SM',
          familyHeadId,
          dataQualityFlags,
          createdBy: superAdmin._id || superAdmin.id,
          updatedBy: superAdmin._id || superAdmin.id,
        });

        if (cleanVoter.pollingStationId) {
          await dbStore.pollingStations.updateOne(
            { _id: cleanVoter.pollingStationId },
            { $inc: { voterCount: 1 } }
          );
        }
        logger.info(
          `Seeded Synthetic Voter: Booth #${cleanVoter.boothSerialNumber} - ${cleanVoter.fullName} [${existing.familyRole}]`
        );
      }
      if (v.epicNumber) {
        voterMap.set(v.epicNumber, existing._id || existing.id);
      }
    }
  } else {
    for (const epic of defaultSyntheticEpics) {
      const existing = await dbStore.voters.findOne({ epicNumber: epic });
      if (existing) {
        await dbStore.voters.deleteOne({ _id: existing._id || existing.id });
      }
    }
    for (const b of seededBooths) {
      const actualCount = await dbStore.voters.countDocuments({
        pollingStationId: b._id || b.id,
        isArchived: false,
      });
      await dbStore.pollingStations.updateOne(
        { _id: b._id || b.id },
        { $set: { voterCount: actualCount } }
      );
    }
    logger.info('Clean database mode: Default synthetic voters excluded.');
  }

  // 4. Test Audit Logs
  await logAuditEvent({
    actor: superAdmin,
    action: 'SYSTEM_BOOTSTRAP',
    entityType: 'SYSTEM',
    outcome: 'SUCCESS',
    ipAddress: '127.0.0.1',
    userAgent: 'ElectionDesk Test Fixture Daemon',
    details: { message: `Test fixtures initialized (seedVoters=${shouldSeedVoters})` },
  });

  // 5. Governance policy
  await dbStore.governance.getPolicy();
  logger.info('Database seeding completed successfully.');
}

// Alias for test files expecting seedDatabase
export { setupTestFixtures as seedDatabase };
