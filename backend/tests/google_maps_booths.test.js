import { describe, it, expect, beforeEach } from 'vitest';
import { dbStore } from '../src/services/store.js';
import { seedDatabase } from './helpers/testFixtures.js';
import {
  autocompleteAddress,
  getPlaceDetails,
  parseGooglePlaceDetails,
  geocodeAddress,
  reverseGeocodeCoordinates,
} from '../src/services/placesService.js';
import {
  createPollingStation,
  updatePollingStation,
  getPollingStationById,
  listPollingStations,
} from '../src/services/pollingStationService.js';
import {
  createVoter,
  updateVoter,
  getVoterById,
} from '../src/services/voterService.js';
import { boothSchema } from '../src/validators/boothValidator.js';
import { createVoterSchema, updateVoterSchema } from '../src/validators/voterValidator.js';
import { requireRole } from '../src/middleware/rbacMiddleware.js';
import { UserRole } from '../src/models/User.js';

describe('Google Maps Platform Integration, Coordinate Validation & Booth Management', () => {
  let adminUser;
  let readOnlyUser;

  beforeEach(async () => {
    dbStore.clearMemoryStore();
    await seedDatabase();
    adminUser = await dbStore.users.findOne({ email: 'dataadmin@electiondesk.gov' });
    readOnlyUser = await dbStore.users.findOne({ email: 'readonly@electiondesk.gov' });
  });

  // 1. Address Autocomplete & Details
  describe('Voter Address Autocomplete & Component Parsing', () => {
    it('provides address suggestions biased to Patiala, Punjab and surrounding areas', async () => {
      const suggestions = await autocompleteAddress('Model Town Patiala');
      expect(suggestions.length).toBeGreaterThan(0);
      const match = suggestions[0];
      expect(match.description).toContain('Model Town');
      expect(match.description).toContain('Patiala');

      const details = await getPlaceDetails(match.placeId);
      expect(details.city).toBe('Patiala');
      expect(details.state).toBe('Punjab');
      expect(details.district).toBe('Patiala');
      expect(details.pinCode).toBe('147001');
      expect(typeof details.latitude).toBe('number');
      expect(typeof details.longitude).toBe('number');
    });

    it('correctly parses raw Google Places API payload into structured address components and numeric coordinates', () => {
      const googlePlacePayload = {
        name: 'Government Mohindra College',
        formatted_address: 'Lower Mall Road, Near Leela Bhawan, Patiala, Punjab 147001, India',
        address_components: [
          { long_name: 'Lower Mall Road', short_name: 'Lower Mall Rd', types: ['route'] },
          { long_name: 'Leela Bhawan', short_name: 'Leela Bhawan', types: ['sublocality_level_1'] },
          { long_name: 'Patiala', short_name: 'Patiala', types: ['locality'] },
          { long_name: 'Patiala', short_name: 'Patiala', types: ['administrative_area_level_2'] },
          { long_name: 'Punjab', short_name: 'PB', types: ['administrative_area_level_1'] },
          { long_name: 'India', short_name: 'IN', types: ['country'] },
          { long_name: '147001', short_name: '147001', types: ['postal_code'] },
        ],
        geometry: {
          location: { lat: 30.3398, lng: 76.3869 },
        },
      };

      const parsed = parseGooglePlaceDetails(googlePlacePayload);
      expect(parsed.street).toBe('Lower Mall Road');
      expect(parsed.locality).toBe('Leela Bhawan');
      expect(parsed.city).toBe('Patiala');
      expect(parsed.district).toBe('Patiala');
      expect(parsed.state).toBe('Punjab');
      expect(parsed.pinCode).toBe('147001');
      expect(parsed.country).toBe('India');
      expect(parsed.latitude).toBe(30.3398);
      expect(parsed.longitude).toBe(76.3869);
    });

    it('gracefully handles missing API key or offline status by synthesizing structured Patiala addresses', async () => {
      const result = await autocompleteAddress('House 88, Near NIS, Patiala');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].components.city).toBe('Patiala');
      expect(result[0].components.state).toBe('Punjab');
      expect(result[0].components.houseNumber).toBe('88');
    });
  });

  // 2. Geocoding & Reverse Geocoding Services
  describe('Geocoding & Reverse Geocoding Services', () => {
    it('geocodes address string to coordinates and structured parts', async () => {
      const result = await geocodeAddress('Model Town, Patiala, Punjab');
      expect(result).toBeDefined();
      expect(result.latitude).toBeGreaterThan(30.0);
      expect(result.latitude).toBeLessThan(31.0);
      expect(result.longitude).toBeGreaterThan(76.0);
      expect(result.longitude).toBeLessThan(77.0);
      expect(result.components.city).toBe('Patiala');
    });

    it('rejects empty or whitespace-only geocoding queries', async () => {
      await expect(geocodeAddress('')).rejects.toThrow(/Address string is required/);
      await expect(geocodeAddress('   ')).rejects.toThrow(/Address string is required/);
    });

    it('reverse geocodes coordinates to a locality in Patiala', async () => {
      const rev = await reverseGeocodeCoordinates(30.3398, 76.3869);
      expect(rev).toBeDefined();
      expect(rev.latitude).toBe(30.3398);
      expect(rev.longitude).toBe(76.3869);
      expect(rev.components.city).toBe('Patiala');
      expect(rev.components.state).toBe('Punjab');
    });

    it('rejects invalid or out-of-range coordinates in reverse geocoding', async () => {
      await expect(reverseGeocodeCoordinates(999, 76.3869)).rejects.toThrow(/Valid numeric latitude/);
      await expect(reverseGeocodeCoordinates(30.3398, -999)).rejects.toThrow(/Valid numeric latitude/);
      await expect(reverseGeocodeCoordinates('invalid', 'coord')).rejects.toThrow(/Valid numeric latitude/);
    });
  });

  // 3. Schema & Coordinate Boundary Validations
  describe('Schema Coordinate Validation (Zod Validation)', () => {
    it('validates correct geographic coordinates for a polling booth', () => {
      const validBooth = {
        officialBoothNumber: 'PB-TEST-1',
        stationName: 'Test Khalsa Girls High School',
        electoralArea: 'Ward 8, Patiala',
        assemblyConstituency: '115 - Patiala Urban',
        parliamentaryConstituency: '13 - Patiala',
        district: 'Patiala',
        address: 'Sirhind Road, Patiala 147001',
        location: {
          latitude: 30.3456,
          longitude: 76.3912,
        },
      };

      const parsed = boothSchema.parse(validBooth);
      expect(parsed.location.latitude).toBe(30.3456);
      expect(parsed.location.longitude).toBe(76.3912);
    });

    it('rejects out-of-range latitude in booth location', () => {
      const invalidLatBooth = {
        officialBoothNumber: 'PB-TEST-2',
        stationName: 'Test School',
        electoralArea: 'Ward 8',
        assemblyConstituency: '115 - Patiala Urban',
        parliamentaryConstituency: '13 - Patiala',
        district: 'Patiala',
        address: 'Valid Address String',
        location: {
          latitude: 95.0, // Invalid: exceeds 90 degrees
          longitude: 76.3912,
        },
      };

      expect(() => boothSchema.parse(invalidLatBooth)).toThrow(/Latitude must be between -90 and 90/);
    });

    it('rejects out-of-range longitude in booth location', () => {
      const invalidLngBooth = {
        officialBoothNumber: 'PB-TEST-3',
        stationName: 'Test School',
        electoralArea: 'Ward 8',
        assemblyConstituency: '115 - Patiala Urban',
        parliamentaryConstituency: '13 - Patiala',
        district: 'Patiala',
        address: 'Valid Address String',
        location: {
          latitude: 30.3456,
          longitude: 200.0, // Invalid: exceeds 180 degrees
        },
      };

      expect(() => boothSchema.parse(invalidLngBooth)).toThrow(/Longitude must be between -180 and 180/);
    });

    it('validates coordinates inside voter address schema', () => {
      const validVoter = {
        boothSerialNumber: 55,
        fullName: 'Manpreet Singh',
        relativeName: 'Jagjit Singh',
        gender: 'Male',
        age: 29,
        address: {
          houseNumber: 'SCO 12',
          street: 'Leela Bhawan Market',
          locality: 'Leela Bhawan',
          city: 'Patiala',
          district: 'Patiala',
          state: 'Punjab',
          pinCode: '147001',
          latitude: 30.3398,
          longitude: 76.3869,
        },
      };

      const parsed = createVoterSchema.parse(validVoter);
      expect(parsed.address.latitude).toBe(30.3398);
      expect(parsed.address.longitude).toBe(76.3869);
    });

    it('rejects out-of-range coordinates inside voter address schema', () => {
      const invalidVoter = {
        boothSerialNumber: 56,
        fullName: 'Invalid Voter',
        relativeName: 'Relative',
        gender: 'Male',
        age: 30,
        address: {
          city: 'Patiala',
          district: 'Patiala',
          state: 'Punjab',
          pinCode: '147001',
          latitude: -95.0, // Invalid
          longitude: 76.3869,
        },
      };

      expect(() => createVoterSchema.parse(invalidVoter)).toThrow(/Latitude must be between -90 and 90/);
    });
  });

  // 4. Polling Booth Creation & Location Updates
  describe('Polling Booth Creation & Map Location Updates', () => {
    it('creates a polling booth with official identifiers and geographic coordinates', async () => {
      const boothData = {
        officialBoothNumber: 'PB-115-Z',
        stationName: 'Govt Polytechnic College Hall',
        electoralArea: 'Ward 12, Badungar Road',
        assemblyConstituency: '115 - Patiala Urban',
        parliamentaryConstituency: '13 - Patiala',
        district: 'Patiala',
        address: 'Badungar Road, Patiala, Punjab 147001',
        location: {
          latitude: 30.3312,
          longitude: 76.3789,
        },
        status: 'Active',
      };

      const booth = await createPollingStation(boothData, adminUser);
      expect(booth).toBeDefined();
      expect(booth.officialBoothNumber).toBe('PB-115-Z');
      expect(booth.location.latitude).toBe(30.3312);
      expect(booth.location.longitude).toBe(76.3789);

      const fetched = await getPollingStationById(booth._id || booth.id);
      expect(fetched.stationName).toBe('Govt Polytechnic College Hall');
      expect(fetched.location.latitude).toBe(30.3312);
    });

    it('allows authorized administrators to update a booth location coordinates', async () => {
      const existing = await dbStore.pollingStations.findOne({ officialBoothNumber: '42' });
      const boothId = existing._id || existing.id;

      const newCoords = {
        latitude: 30.3299,
        longitude: 76.4011,
      };

      const updated = await updatePollingStation(
        boothId,
        {
          location: newCoords,
          address: 'Updated Passi Road Complex, Patiala',
        },
        adminUser
      );

      expect(updated.location.latitude).toBe(30.3299);
      expect(updated.location.longitude).toBe(76.4011);
      expect(updated.address).toBe('Updated Passi Road Complex, Patiala');

      // Verify audit log record created for booth update
      const { logs } = await dbStore.auditLogs.query({ filter: { entityId: boothId } });
      const boothUpdateLog = logs.find((l) => l.action === 'BOOTH_UPDATE');
      expect(boothUpdateLog).toBeDefined();
      expect(boothUpdateLog.outcome).toBe('SUCCESS');
    });

    it('preserves existing voter-to-booth associations when booth location is updated', async () => {
      const booth = await dbStore.pollingStations.findOne({ officialBoothNumber: '42' });
      const boothId = booth._id || booth.id;

      // Find voters assigned to this booth
      const votersBefore = await dbStore.voters.find({ pollingStationId: boothId });
      expect(votersBefore.length).toBeGreaterThan(0);
      const voterIdsBefore = votersBefore.map((v) => v._id || v.id);

      // Update booth coordinates
      await updatePollingStation(
        boothId,
        { location: { latitude: 30.326, longitude: 76.399 } },
        adminUser
      );

      // Ensure voter associations are completely preserved
      const votersAfter = await dbStore.voters.find({ pollingStationId: boothId });
      expect(votersAfter.length).toBe(votersBefore.length);
      const voterIdsAfter = votersAfter.map((v) => v._id || v.id);
      expect(voterIdsAfter).toEqual(voterIdsBefore);
    });
  });

  // 5. Voter Record Integration with Coordinates
  describe('Voter Record Coordinates & Non-Overwriting Logic', () => {
    it('creates and retrieves a voter record with optional geographic coordinates', async () => {
      const newVoterData = {
        boothSerialNumber: 201,
        fullName: 'Balwinder Kaur',
        relativeName: 'Surjit Singh',
        relationType: 'Husband',
        gender: 'Female',
        age: 34,
        address: {
          houseNumber: '15-C',
          street: 'Urban Estate Phase 1',
          locality: 'Urban Estate',
          city: 'Patiala',
          district: 'Patiala',
          state: 'Punjab',
          pinCode: '147002',
          latitude: 30.3542,
          longitude: 76.4385,
          verified: true,
        },
      };

      const validated = createVoterSchema.parse(newVoterData);
      const created = await createVoter(validated, adminUser);
      expect(created.address.latitude).toBe(30.3542);
      expect(created.address.longitude).toBe(76.4385);

      const fetched = await getVoterById(created._id || created.id);
      expect(fetched.address.latitude).toBe(30.3542);
      expect(fetched.address.longitude).toBe(76.4385);
    });

    it('updates voter record without wiping existing coordinates if not provided in partial update', async () => {
      const voter = await dbStore.voters.findOne({ epicNumber: 'PB1049281' });
      const voterId = voter._id || voter.id;

      // Set initial coordinates
      await updateVoter(
        voterId,
        {
          address: {
            ...voter.address,
            latitude: 30.3256,
            longitude: 76.3982,
          },
        },
        adminUser
      );

      const afterFirstUpdate = await getVoterById(voterId);
      expect(afterFirstUpdate.address.latitude).toBe(30.3256);

      // Update only mobile number - verify address coordinates remain intact
      await updateVoter(
        voterId,
        { mobileNumber: '9876543210' },
        adminUser
      );

      const afterSecondUpdate = await getVoterById(voterId);
      expect(afterSecondUpdate.mobileNumber).toBe('9876543210');
      expect(afterSecondUpdate.address.latitude).toBe(30.3256);
      expect(afterSecondUpdate.address.longitude).toBe(76.3982);
    });
  });

  // 6. RBAC & Security Requirements
  describe('RBAC & Location Administration Authorization Controls', () => {
    it('blocks Read-Only users from updating polling booth locations', async () => {
      const rbacMiddleware = requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN);

      let statusCode = 200;
      let responseBody = null;
      let nextCalled = false;

      const req = {
        user: readOnlyUser,
        ip: '127.0.0.1',
        headers: {},
        originalUrl: '/api/v1/polling-stations/123',
      };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        },
      };

      await rbacMiddleware(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(403);
      expect(responseBody.error.code).toBe('FORBIDDEN');
    });

    it('allows DATA_ADMIN and SUPER_ADMIN to manage booth locations', async () => {
      const rbacMiddleware = requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN);

      let nextCalled = false;
      const req = {
        user: adminUser,
        ip: '127.0.0.1',
        headers: {},
        originalUrl: '/api/v1/polling-stations',
      };
      const res = {
        status(code) {
          return this;
        },
        json(body) {
          return this;
        },
      };

      await rbacMiddleware(req, res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
    });
  });
});
