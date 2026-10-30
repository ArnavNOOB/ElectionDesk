import { describe, it, expect, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { dbStore } from '../src/services/store.js';
import { seedDatabase } from './helpers/testFixtures.js';
import {
  parseSpreadsheet,
  generateSampleXlsx,
  previewSpreadsheetImport,
  commitSpreadsheetImport,
} from '../src/services/importExportService.js';

describe('Spreadsheet Import with Age and Gender Support', () => {
  beforeEach(async () => {
    dbStore.clearMemoryStore();
    await seedDatabase({ seedVoters: false });
  });

  it('generateSampleXlsx generates valid XLSX buffer with Age and Gender columns (and without City and Pin Code)', () => {
    const buffer = generateSampleXlsx();
    expect(Buffer.isBuffer(buffer)).toBe(true);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    expect(rows.length).toBeGreaterThan(0);
    const firstRow = rows[0];

    // Mandatory columns
    expect(firstRow).toHaveProperty('FULL_NAME');
    expect(firstRow).toHaveProperty('BOOTH_SERIAL_NO');

    // AGE and GENDER should be present in the sample template rows
    expect(firstRow).toHaveProperty('AGE');
    expect(firstRow).toHaveProperty('GENDER');
    expect(firstRow.AGE).toBe(38);
    expect(firstRow.GENDER).toBe('Male');

    // CITY and PIN_CODE remain omitted
    expect(firstRow).not.toHaveProperty('CITY');
    expect(firstRow).not.toHaveProperty('PIN_CODE');
  });

  it('previewSpreadsheetImport correctly parses specified AGE and GENDER (including shorthand values)', async () => {
    const csvContent = [
      'BOOTH_SERIAL_NO,BOOTH_NUMBER,FULL_NAME,GENDER,AGE,RELATIVE_NAME,RELATION_TYPE,EPIC_NO',
      '1,42,Maninder Singh,Male,45,Jasbir Singh,Father,PBX1001',
      '2,42,Kiranjeet Kaur,F,42,Maninder Singh,Husband,PBX1002',
      '3,42,Simranjeet Singh,m,21,Maninder Singh,Father,PBX1003',
      '4,42,Navjot Kaur,Third Gender,30,Gurmel Singh,Father,PBX1004',
    ].join('\n');

    const preview = await previewSpreadsheetImport(csvContent, 'voters_with_demographics.csv');
    expect(preview.errorCount).toBe(0);
    expect(preview.validCount).toBe(4);

    expect(preview.validRows[0].gender).toBe('Male');
    expect(preview.validRows[0].age).toBe(45);

    expect(preview.validRows[1].gender).toBe('Female');
    expect(preview.validRows[1].age).toBe(42);

    expect(preview.validRows[2].gender).toBe('Male');
    expect(preview.validRows[2].age).toBe(21);

    expect(preview.validRows[3].gender).toBe('Third Gender');
    expect(preview.validRows[3].age).toBe(30);
  });

  it('parseSpreadsheet parses rows without AGE, GENDER, CITY, and PIN_CODE headers without throwing', () => {
    const csvContent = [
      'BOOTH_SERIAL_NO,FULL_NAME,RELATIVE_NAME,RELATION_TYPE,EPIC_NO,LOCALITY',
      '1,Maninder Singh,Jasbir Singh,Father,PBX1001,Urban Estate',
      '2,Kiranjeet Kaur,Maninder Singh,Husband,PBX1002,Urban Estate',
    ].join('\n');

    const rows = parseSpreadsheet(csvContent);
    expect(rows.length).toBe(2);
    expect(rows[0].FULL_NAME).toBe('Maninder Singh');
    expect(rows[1].FULL_NAME).toBe('Kiranjeet Kaur');
    expect(rows[0].AGE).toBeUndefined();
    expect(rows[0].GENDER).toBeUndefined();
    expect(rows[0].CITY).toBeUndefined();
    expect(rows[0].PIN_CODE).toBeUndefined();
  });

  it('previewSpreadsheetImport succeeds with 0 errors when age, gender, city, and pincode are omitted', async () => {
    const csvContent = [
      'BOOTH_SERIAL_NO,FULL_NAME,RELATIVE_NAME,RELATION_TYPE,EPIC_NO,HOUSE_NO,STREET,LOCALITY,WARD,DISTRICT,STATE',
      '1,Rajesh Kumar,Ram Lal,Father,EPIC9001,45,Main Bazaar,Leela Bhawan,Ward 4,Patiala,Punjab',
      '2,Simran Kaur,Rajesh Kumar,Husband,EPIC9002,45,Main Bazaar,Leela Bhawan,Ward 4,Patiala,Punjab',
    ].join('\n');

    const preview = await previewSpreadsheetImport(csvContent, 'voters.csv');

    expect(preview.totalRows).toBe(2);
    expect(preview.validCount).toBe(2);
    expect(preview.errorCount).toBe(0);
    expect(preview.duplicateCount).toBe(0);
    expect(preview.errors.length).toBe(0);

    const firstVoter = preview.validRows[0];
    expect(firstVoter.fullName).toBe('Rajesh Kumar');
    // Verify default fallbacks are properly applied
    expect(firstVoter.age).toBe(18);
    expect(firstVoter.gender).toBe('Male');
    expect(firstVoter.address.city).toBe('Patiala');
    expect(firstVoter.address.pinCode).toBe('147001');
    expect(firstVoter.address.district).toBe('Patiala');
    expect(firstVoter.address.state).toBe('Punjab');
  });

  it('commitSpreadsheetImport saves records with default values when fields are absent', async () => {
    const csvContent = [
      'BOOTH_SERIAL_NO,FULL_NAME,RELATIVE_NAME,RELATION_TYPE,EPIC_NO,FAMILY_ROLE',
      '1,Kewal Krishan,Devi Dayal,Father,EPIC1111,FH',
      '2,Sunita Rani,Kewal Krishan,Husband,EPIC1112,FM',
    ].join('\n');

    const preview = await previewSpreadsheetImport(csvContent);
    expect(preview.validRows.length).toBe(2);

    const actor = { _id: 'user_admin_01', username: 'admin', role: 'admin' };
    const commitResult = await commitSpreadsheetImport(preview.validRows, actor, {
      ipAddress: '127.0.0.1',
      userAgent: 'Automated-Test',
    });

    expect(commitResult.success).toBe(true);
    expect(commitResult.importedCount).toBe(2);

    // Verify stored voters in database
    const headVoter = await dbStore.voters.findOne({ epicNumber: 'EPIC1111' });
    expect(headVoter).toBeDefined();
    expect(headVoter.fullName).toBe('Kewal Krishan');
    expect(headVoter.age).toBe(18);
    expect(headVoter.gender).toBe('Male');
    expect(headVoter.address.city).toBe('Patiala');
    expect(headVoter.address.pinCode).toBe('147001');
    expect(headVoter.address.villageWard).toBe('12');
    expect(headVoter.familyRole).toBe('FH');

    const memberVoter = await dbStore.voters.findOne({ epicNumber: 'EPIC1112' });
    expect(memberVoter).toBeDefined();
    expect(memberVoter.fullName).toBe('Sunita Rani');
    expect(memberVoter.address.villageWard).toBe('12');
    expect(memberVoter.familyRole).toBe('FM');
  });

  it('correctly associates whole number booth numbers such as 42, 43, 44, 45', async () => {
    const csvContent = [
      'BOOTH_SERIAL_NO,BOOTH_NUMBER,FULL_NAME,RELATIVE_NAME,RELATION_TYPE,EPIC_NO',
      '1,42,Jaswinder Singh,Kuldeep Singh,Father,EPIC4201',
      '2,43,Harinder Kaur,Jaswinder Singh,Husband,EPIC4301',
    ].join('\n');

    const preview = await previewSpreadsheetImport(csvContent, 'voters_booths.csv');
    expect(preview.errorCount).toBe(0);
    expect(preview.validCount).toBe(2);

    const booth42 = await dbStore.pollingStations.findOne({ officialBoothNumber: '42' });
    expect(booth42).toBeDefined();
    expect(preview.validRows[0].pollingStationId).toBe(booth42._id || booth42.id);

    const booth43 = await dbStore.pollingStations.findOne({ officialBoothNumber: '43' });
    expect(booth43).toBeDefined();
    expect(preview.validRows[1].pollingStationId).toBe(booth43._id || booth43.id);
  });

  it('supports importing large batches up to 1500 rows', async () => {
    const lines = ['BOOTH_SERIAL_NO,BOOTH_NUMBER,FULL_NAME,RELATIVE_NAME,RELATION_TYPE,EPIC_NO'];
    for (let i = 1; i <= 1500; i++) {
      lines.push(`${i},42,Voter Batch ${i},Relative ${i},Father,BATCH${i.toString().padStart(5, '0')}`);
    }
    const csvContent = lines.join('\n');

    const preview = await previewSpreadsheetImport(csvContent, 'large_import.csv');
    expect(preview.totalRows).toBe(1500);
    expect(preview.validCount).toBe(1500);
    expect(preview.validRows.length).toBe(1500);
    expect(preview.errorCount).toBe(0);

    const actor = { _id: 'user_admin_01', username: 'admin', role: 'admin' };
    const commitResult = await commitSpreadsheetImport(preview.validRows, actor, {
      ipAddress: '127.0.0.1',
      userAgent: 'Automated-Test',
    });

    expect(commitResult.success).toBe(true);
    expect(commitResult.importedCount).toBe(1500);

    // Verify booth voter count incremented by 1500
    const booth42 = await dbStore.pollingStations.findOne({ officialBoothNumber: '42' });
    expect(booth42.voterCount).toBeGreaterThanOrEqual(1500);
  });

  it('verifies only the 5 specified booths (42, 43, 44, 45, 46) exist and have default Ward 12', async () => {
    const booths = await dbStore.pollingStations.find();
    expect(booths.length).toBe(5);
    const boothNumbers = booths.map((b) => b.officialBoothNumber).sort();
    expect(boothNumbers).toEqual(['42', '43', '44', '45', '46']);
    for (const b of booths) {
      expect(b.electoralArea).toBe('Ward 12');
    }
  });

  it('detects intra-file duplicate booth serial numbers within the same polling booth', async () => {
    const csvContent = [
      'BOOTH_SERIAL_NO,BOOTH_NUMBER,FULL_NAME,RELATIVE_NAME,RELATION_TYPE,EPIC_NO',
      '1,42,Harpreet Singh,Jagjit Singh,Father,PB1001',
      '1,42,Manpreet Singh,Jagjit Singh,Father,PB1002', // Duplicate serial #1 in booth 42
    ].join('\n');

    const preview = await previewSpreadsheetImport(csvContent, 'duplicate_serials.csv');
    expect(preview.totalRows).toBe(2);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.cleanCount).toBe(1);
    expect(preview.duplicateRows.length).toBe(1);

    const dup = preview.duplicateRows[0];
    expect(dup.row).toBe(3);
    expect(dup.boothSerialNumber).toBe(1);
    expect(dup.duplicateFlags).toContain('DUPLICATE_SERIAL_ID');
    expect(dup.reason).toContain('Duplicate Booth Serial #1');
    expect(dup.reason).toContain('Row #2');

    // In validRows, row 2 should be flagged as duplicate
    expect(preview.validRows[0].isDuplicate).toBe(false);
    expect(preview.validRows[1].isDuplicate).toBe(true);
    expect(preview.validRows[1].duplicateFlags).toContain('DUPLICATE_SERIAL_ID');
  });

  it('detects intra-file duplicate EPIC numbers', async () => {
    const csvContent = [
      'BOOTH_SERIAL_NO,BOOTH_NUMBER,FULL_NAME,RELATIVE_NAME,RELATION_TYPE,EPIC_NO',
      '1,42,Harpreet Singh,Jagjit Singh,Father,PB9999999',
      '2,43,Duplicate EPIC Person,Gurmel Singh,Father,PB9999999', // Duplicate EPIC
    ].join('\n');

    const preview = await previewSpreadsheetImport(csvContent, 'duplicate_epics.csv');
    expect(preview.totalRows).toBe(2);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.cleanCount).toBe(1);
    expect(preview.duplicateRows.length).toBe(1);

    const dup = preview.duplicateRows[0];
    expect(dup.row).toBe(3);
    expect(dup.epic).toBe('PB9999999');
    expect(dup.duplicateFlags).toContain('DUPLICATE_EPIC_NUMBER');
    expect(dup.reason).toContain('Duplicate EPIC number "PB9999999"');
  });

  it('detects duplicate records against existing database records', async () => {
    // Insert an existing voter in booth 42 with serial 10 and EPIC 'PB5555555'
    const booth42 = await dbStore.pollingStations.findOne({ officialBoothNumber: '42' });
    await dbStore.voters.create({
      boothSerialNumber: 10,
      epicNumber: 'PB5555555',
      fullName: 'Pre-existing Voter',
      pollingStationId: booth42._id || booth42.id,
      familyRole: 'SM',
      city: 'Patiala',
      district: 'Patiala',
      state: 'Punjab',
      address: { pinCode: '147001', city: 'Patiala', district: 'Patiala', state: 'Punjab' },
    });

    const csvContent = [
      'BOOTH_SERIAL_NO,BOOTH_NUMBER,FULL_NAME,RELATIVE_NAME,RELATION_TYPE,EPIC_NO',
      '10,42,Incoming Serial Conflict,Gurdit Singh,Father,PB1049281', // Serial 10 exists in booth 42
      '20,43,Incoming EPIC Conflict,Mohan Lal,Father,PB5555555', // EPIC PB5555555 exists in DB
    ].join('\n');

    const preview = await previewSpreadsheetImport(csvContent, 'db_duplicates.csv');
    expect(preview.duplicateCount).toBe(2);
    expect(preview.cleanCount).toBe(0);

    const serialDup = preview.duplicateRows.find((d) => d.boothSerialNumber === 10);
    expect(serialDup).toBeDefined();
    expect(serialDup.duplicateFlags).toContain('DUPLICATE_SERIAL_ID');
    expect(serialDup.conflictWith).toContain('Database Record');

    const epicDup = preview.duplicateRows.find((d) => d.epic === 'PB5555555');
    expect(epicDup).toBeDefined();
    expect(epicDup.duplicateFlags).toContain('DUPLICATE_EPIC_NUMBER');
    expect(epicDup.conflictWith).toContain('Database Record');
  });

  it('commits spreadsheet with skipDuplicates: true by omitting duplicate records', async () => {
    const csvContent = [
      'BOOTH_SERIAL_NO,BOOTH_NUMBER,FULL_NAME,RELATIVE_NAME,RELATION_TYPE,EPIC_NO',
      '1,42,Unique Voter A,Jagjit Singh,Father,PBA001',
      '1,42,Duplicate Voter B,Jagjit Singh,Father,PBA002', // Intra-file duplicate serial
    ].join('\n');

    const preview = await previewSpreadsheetImport(csvContent);
    expect(preview.validRows.length).toBe(2);
    expect(preview.duplicateCount).toBe(1);

    const actor = { _id: 'user_admin_01', username: 'admin', role: 'admin' };
    const commitResult = await commitSpreadsheetImport(preview.validRows, actor, {
      ipAddress: '127.0.0.1',
    }, { skipDuplicates: true });

    expect(commitResult.success).toBe(true);
    expect(commitResult.importedCount).toBe(1);
    expect(commitResult.skippedDuplicateCount).toBe(1);

    // Only Voter A should exist in the database
    const voterA = await dbStore.voters.findOne({ epicNumber: 'PBA001' });
    expect(voterA).toBeDefined();
    const voterB = await dbStore.voters.findOne({ epicNumber: 'PBA002' });
    expect(voterB).toBeNull();
  });

  it('commits spreadsheet with duplicates flagged and updates existing conflicting voter', async () => {
    const booth42 = await dbStore.pollingStations.findOne({ officialBoothNumber: '42' });
    const existing = await dbStore.voters.create({
      boothSerialNumber: 5,
      epicNumber: 'PBEXIST5',
      fullName: 'Original Booth 5 Voter',
      pollingStationId: booth42._id || booth42.id,
      familyRole: 'SM',
      isDuplicate: false,
      duplicateFlags: [],
      dataQualityFlags: [],
      address: { pinCode: '147001', city: 'Patiala', district: 'Patiala', state: 'Punjab' },
    });

    const csvContent = [
      'BOOTH_SERIAL_NO,BOOTH_NUMBER,FULL_NAME,RELATIVE_NAME,RELATION_TYPE,EPIC_NO',
      '5,42,Duplicate Incoming Voter,Surjit Singh,Father,PBINCOMING5',
    ].join('\n');

    const preview = await previewSpreadsheetImport(csvContent);
    const actor = { _id: 'user_admin_01', username: 'admin', role: 'admin' };

    const commitResult = await commitSpreadsheetImport(preview.validRows, actor, {
      ipAddress: '127.0.0.1',
    }, { skipDuplicates: false });

    expect(commitResult.success).toBe(true);
    expect(commitResult.importedCount).toBe(1);
    expect(commitResult.flaggedDuplicateCount).toBe(1);

    // Verify incoming voter is saved with duplicate flag
    const incoming = await dbStore.voters.findOne({ epicNumber: 'PBINCOMING5' });
    expect(incoming).toBeDefined();
    expect(incoming.isDuplicate).toBe(true);
    expect(incoming.duplicateFlags).toContain('DUPLICATE_SERIAL_ID');
    expect(incoming.dataQualityFlags).toContain('DUPLICATE_SERIAL_ID');

    // Verify original existing voter is ALSO updated with duplicate flag
    const updatedOriginal = await dbStore.voters.findById(existing._id || existing.id);
    expect(updatedOriginal.isDuplicate).toBe(true);
    expect(updatedOriginal.duplicateFlags).toContain('DUPLICATE_SERIAL_ID');
    expect(updatedOriginal.dataQualityFlags).toContain('DUPLICATE_SERIAL_ID');
  });
});
