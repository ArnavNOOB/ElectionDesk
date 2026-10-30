import { describe, it, expect, beforeEach } from 'vitest';
import { dbStore } from '../src/services/store.js';
import { seedDatabase } from './helpers/testFixtures.js';
import {
  createVoter,
  updateVoter,
  archiveVoter,
  restoreVoter,
  listVoters,
  getVoterById,
  evaluateDataQuality,
} from '../src/services/voterService.js';
import { createVoterSchema } from '../src/validators/voterValidator.js';

describe('Voter Records CRUD & Business Logic Tests', () => {
  let adminUser;

  beforeEach(async () => {
    dbStore.clearMemoryStore();
    await seedDatabase();
    adminUser = await dbStore.users.findOne({ email: 'dataadmin@electiondesk.gov' });
  });

  it('creates a new voter record with validated address fields', async () => {
    const voterPayload = {
      boothSerialNumber: 101,
      epicNumber: 'KAR5501928',
      fullName: 'Sunita Radhakrishnan',
      relativeName: 'Radhakrishnan Nair',
      relationType: 'Father',
      gender: 'Female',
      age: 38,
      address: {
        houseNumber: '12-B',
        street: 'CMH Road',
        locality: 'Indiranagar',
        city: 'Bengaluru',
        district: 'Bengaluru Urban',
        state: 'Karnataka',
        pinCode: '560038',
        country: 'India',
        verified: true,
      },
    };

    const validated = createVoterSchema.parse(voterPayload);
    const newVoter = await createVoter(validated, adminUser);

    expect(newVoter).toBeDefined();
    expect(newVoter.boothSerialNumber).toBe(101);
    expect(newVoter.epicNumber).toBe('KAR5501928');
    expect(newVoter.isDuplicate).toBe(false);

    const fetched = await getVoterById(newVoter._id || newVoter.id);
    expect(fetched.fullName).toBe('Sunita Radhakrishnan');
    expect(fetched.boothSerialNumber).toBe(101);
  });

  it('rejects invalid PIN code format via Zod schema validation', () => {
    const invalidPayload = {
      boothSerialNumber: 102,
      epicNumber: 'KAR9999999',
      fullName: 'Test User',
      relativeName: 'Relative',
      gender: 'Male',
      age: 25,
      address: {
        city: 'Bengaluru',
        district: 'Bengaluru Urban',
        state: 'Karnataka',
        pinCode: 'ABC12', // Invalid PIN
      },
    };

    expect(() => createVoterSchema.parse(invalidPayload)).toThrow(/valid 6-digit Indian PIN code/);
  });

  it('enforces unique booth serial number per polling station', async () => {
    const booth = await dbStore.pollingStations.findOne({ officialBoothNumber: '42' });
    const boothId = booth._id || booth.id;

    // Create voter 1 with boothSerialNumber: 42
    await createVoter(
      createVoterSchema.parse({
        boothSerialNumber: 42,
        pollingStationId: boothId,
        fullName: 'First Voter',
        relativeName: 'Guardian',
        gender: 'Male',
        age: 30,
        address: {
          city: 'Patiala',
          district: 'Patiala',
          state: 'Punjab',
          pinCode: '147001',
        },
      }),
      adminUser
    );

    // Attempting to register another voter with same boothSerialNumber: 42 in same booth must fail
    await expect(
      createVoter(
        createVoterSchema.parse({
          boothSerialNumber: 42,
          pollingStationId: boothId,
          fullName: 'Second Voter',
          relativeName: 'Guardian',
          gender: 'Female',
          age: 28,
          address: {
            city: 'Patiala',
            district: 'Patiala',
            state: 'Punjab',
            pinCode: '147001',
          },
        }),
        adminUser
      )
    ).rejects.toThrow(/already registered in this polling booth/);
  });

  it('performs soft deletion (archival) and permitted restoration with audit', async () => {
    const { records } = await listVoters({ limit: 1 });
    const voter = records[0];
    const voterId = voter._id || voter.id;

    // 1. Archive
    await archiveVoter(voterId, 'Voter relocated out of state', adminUser);

    // Verify archived
    const activeList = await listVoters({ isArchived: false });
    expect(activeList.records.some((v) => (v._id || v.id) === voterId)).toBe(false);

    const archivedList = await listVoters({ isArchived: true });
    expect(archivedList.records.some((v) => (v._id || v.id) === voterId)).toBe(true);

    // 2. Restore
    await restoreVoter(voterId, adminUser);

    // Verify restored
    const restoredList = await listVoters({ isArchived: false });
    expect(restoredList.records.some((v) => (v._id || v.id) === voterId)).toBe(true);
  });

  it('correctly evaluates data quality flags for missing or invalid attributes', () => {
    const deficientVoter = {
      fullName: 'Incomplete Record',
      relativeName: '',
      address: {
        pinCode: '9999', // Invalid PIN
        verified: false,
      },
      pollingStationId: null, // No booth
    };

    const flags = evaluateDataQuality(deficientVoter);
    expect(flags).toContain('MISSING_BOOTH_SERIAL');
    expect(flags).toContain('INVALID_OR_MISSING_PIN');
    expect(flags).toContain('UNVERIFIED_ADDRESS');
    expect(flags).toContain('UNASSIGNED_POLLING_BOOTH');
    expect(flags).toContain('MISSING_RELATIVE_NAME');
  });

  it('searches and filters voter directory accurately', async () => {
    const searchRes = await listVoters({ search: 'Aarav Patel' });
    expect(searchRes.records.length).toBeGreaterThan(0);
    expect(searchRes.records[0].fullName).toContain('Aarav');

    const filterRes = await listVoters({ verificationStatus: 'Verified' });
    expect(filterRes.records.every((v) => v.verificationStatus === 'Verified')).toBe(true);

    const dupSerialRes = await listVoters({ duplicateFilter: 'DUPLICATE_SERIAL_ID' });
    expect(dupSerialRes.records.length).toBeGreaterThan(0);
    expect(
      dupSerialRes.records.every(
        (v) =>
          (v.duplicateFlags && v.duplicateFlags.includes('DUPLICATE_SERIAL_ID')) ||
          (v.dataQualityFlags && v.dataQualityFlags.includes('DUPLICATE_SERIAL_ID'))
      )
    ).toBe(true);

    const dupEpicRes = await listVoters({ duplicateFilter: 'DUPLICATE_EPIC_NUMBER' });
    expect(dupEpicRes.records.length).toBeGreaterThan(0);
    expect(
      dupEpicRes.records.every(
        (v) =>
          (v.duplicateFlags && v.duplicateFlags.includes('DUPLICATE_EPIC_NUMBER')) ||
          (v.dataQualityFlags && v.dataQualityFlags.includes('DUPLICATE_EPIC_NUMBER'))
      )
    ).toBe(true);
  });

  it('manages Family Notation (FH, FM, SM) and enforces FM relationship validation', async () => {
    const booth = await dbStore.pollingStations.findOne({ officialBoothNumber: '42' });
    const boothId = booth._id || booth.id;

    // 1. Create a Family Head (FH)
    const head = await createVoter(
      createVoterSchema.parse({
        boothSerialNumber: 201,
        pollingStationId: boothId,
        fullName: 'Davinder Singh',
        relativeName: 'Gurmukh Singh',
        gender: 'Male',
        age: 50,
        familyRole: 'FH',
        address: {
          city: 'Patiala',
          district: 'Patiala',
          state: 'Punjab',
          pinCode: '147001',
        },
      }),
      adminUser
    );
    expect(head.familyRole).toBe('FH');
    expect(head.familyHeadId).toBeNull();

    // 2. Reject creating FM without valid familyHeadId
    await expect(
      createVoter(
        createVoterSchema.parse({
          boothSerialNumber: 202,
          pollingStationId: boothId,
          fullName: 'Manpreet Kaur',
          relativeName: 'Davinder Singh',
          gender: 'Female',
          age: 46,
          familyRole: 'FM',
          address: {
            city: 'Patiala',
            district: 'Patiala',
            state: 'Punjab',
            pinCode: '147001',
          },
        }),
        adminUser
      )
    ).rejects.toThrow(/valid Family Head \(FH\) must be selected/);

    // 3. Create FM linking to head
    const member = await createVoter(
      createVoterSchema.parse({
        boothSerialNumber: 202,
        pollingStationId: boothId,
        fullName: 'Manpreet Kaur',
        relativeName: 'Davinder Singh',
        relationType: 'Husband',
        gender: 'Female',
        age: 46,
        familyRole: 'FM',
        familyHeadId: head._id || head.id,
        address: {
          city: 'Patiala',
          district: 'Patiala',
          state: 'Punjab',
          pinCode: '147001',
        },
      }),
      adminUser
    );
    expect(member.familyRole).toBe('FM');
    expect(String(member.familyHeadId)).toBe(String(head._id || head.id));

    // 4. Verify getVoterById returns family hierarchy
    const headDetails = await getVoterById(head._id || head.id);
    expect(headDetails.familyMembers).toBeDefined();
    expect(headDetails.familyMembers.length).toBe(1);
    expect(headDetails.familyMembers[0].fullName).toBe('Manpreet Kaur');

    const memberDetails = await getVoterById(member._id || member.id);
    expect(memberDetails.familyHead).toBeDefined();
    expect(memberDetails.familyHead.fullName).toBe('Davinder Singh');
  });

  it('includes family members in search results when searching for their family head', async () => {
    // Harpreet Singh Sandhu is FH, Jasleen Kaur Sandhu is FM
    const searchRes = await listVoters({ search: 'Harpreet Singh Sandhu' });

    // Both Harpreet (FH) and Jasleen (FM) must be displayed
    const names = searchRes.records.map((r) => r.fullName);
    expect(names).toContain('Harpreet Singh Sandhu');
    expect(names).toContain('Jasleen Kaur Sandhu');

    const jasleenRecord = searchRes.records.find((r) => r.fullName === 'Jasleen Kaur Sandhu');
    expect(jasleenRecord.familyRole).toBe('FM');
    expect(jasleenRecord.familyHead).toBeDefined();
    expect(jasleenRecord.familyHead.fullName).toBe('Harpreet Singh Sandhu');
  });

  it('searches voters by mobile number and correlates family members', async () => {
    // 1. Search by exact mobile number of Family Head Harpreet (9814012345)
    const resExact = await listVoters({ search: '9814012345' });
    const exactNames = resExact.records.map((r) => r.fullName);
    expect(exactNames).toContain('Harpreet Singh Sandhu');
    // Correlated member Jasleen must also be returned
    expect(exactNames).toContain('Jasleen Kaur Sandhu');

    // 2. Search by formatted mobile number (+91 98140 12345)
    const resFormatted = await listVoters({ search: '+91 98140 12345' });
    const formattedNames = resFormatted.records.map((r) => r.fullName);
    expect(formattedNames).toContain('Harpreet Singh Sandhu');
    expect(formattedNames).toContain('Jasleen Kaur Sandhu');

    // 3. Search by partial mobile number (e.g. 987654)
    const resPartial = await listVoters({ search: '987654' });
    const partialNames = resPartial.records.map((r) => r.fullName);
    expect(partialNames).toContain('Simranjit Kaur Mann');

    // 4. Create new voter with custom mobile number and verify search
    const newVoter = await createVoter(
      createVoterSchema.parse({
        boothSerialNumber: 909,
        fullName: 'Balwinder Singh Sidhu',
        relativeName: 'Gurnam Singh',
        mobileNumber: '9988776655',
        gender: 'Male',
        age: 44,
        address: {
          city: 'Patiala',
          district: 'Patiala',
          state: 'Punjab',
          pinCode: '147001',
        },
      }),
      adminUser
    );
    expect(newVoter.mobileNumber).toBe('9988776655');

    const searchNew = await listVoters({ search: '9988776655' });
    expect(searchNew.records.some((r) => r.fullName === 'Balwinder Singh Sidhu')).toBe(true);
  });

  it('filters voters by locality dropdown (e.g. Indra Colony, New Mehar Singh Colony, etc.)', async () => {
    // Register voters in different localities
    await createVoter(
      createVoterSchema.parse({
        boothSerialNumber: 111,
        fullName: 'Rajesh Kumar Indra',
        relativeName: 'Ram Kumar',
        gender: 'Male',
        age: 35,
        address: {
          houseNumber: '14-A',
          street: 'Gali 2',
          locality: 'Indra Colony',
          city: 'Patiala',
          district: 'Patiala',
          state: 'Punjab',
          pinCode: '147001',
        },
      }),
      adminUser
    );

    await createVoter(
      createVoterSchema.parse({
        boothSerialNumber: 112,
        fullName: 'Manpreet Kaur Mehar',
        relativeName: 'Gurdeep Singh',
        gender: 'Female',
        age: 29,
        address: {
          houseNumber: '25-C',
          street: 'Main Road',
          locality: 'New Mehar Singh Colony',
          city: 'Patiala',
          district: 'Patiala',
          state: 'Punjab',
          pinCode: '147001',
        },
      }),
      adminUser
    );

    await createVoter(
      createVoterSchema.parse({
        boothSerialNumber: 113,
        fullName: 'Satish Sharma Basant',
        relativeName: 'Kailash Sharma',
        gender: 'Male',
        age: 50,
        address: {
          houseNumber: '88',
          street: 'Park Avenue',
          locality: 'Basant Vihar',
          city: 'Patiala',
          district: 'Patiala',
          state: 'Punjab',
          pinCode: '147001',
        },
      }),
      adminUser
    );

    // 1. Filter by 'indra colony'
    const indraResults = await listVoters({ locality: 'indra colony' });
    expect(indraResults.records.length).toBe(1);
    expect(indraResults.records[0].fullName).toBe('Rajesh Kumar Indra');

    // 2. Filter by 'new mehar singh colony'
    const meharResults = await listVoters({ locality: 'new mehar singh colony' });
    expect(meharResults.records.length).toBe(1);
    expect(meharResults.records[0].fullName).toBe('Manpreet Kaur Mehar');

    // 3. Filter by 'basant vihar'
    const basantResults = await listVoters({ locality: 'basant vihar' });
    expect(basantResults.records.length).toBe(1);
    expect(basantResults.records[0].fullName).toBe('Satish Sharma Basant');
  });

  it('supports seeding database without default voters (seedVoters: false)', async () => {
    dbStore.clearMemoryStore();
    await seedDatabase({ seedVoters: false });
    const voterCount = await dbStore.voters.countDocuments();
    expect(voterCount).toBe(0);

    // Verify polling stations still exist with 0 voterCount
    const booths = await dbStore.pollingStations.find();
    expect(booths.length).toBeGreaterThan(0);
    for (const b of booths) {
      expect(b.voterCount).toBe(0);
    }
  });
});
