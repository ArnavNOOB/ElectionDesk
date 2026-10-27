import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPatialaLocalities,
  searchPatialaAddresses,
  autocompleteAddress,
  getPlaceDetails,
  parseGooglePlaceDetails,
  PATIALA_PUNJAB_ADDRESSES,
  PATIALA_LOCALITIES_LIST,
} from '../src/services/placesService.js';
import { dbStore } from '../src/services/store.js';
import { seedDatabase } from './helpers/testFixtures.js';

describe('Patiala, Punjab Address API & Locality Services Tests', () => {
  beforeEach(async () => {
    dbStore.clearMemoryStore();
    await seedDatabase();
  });

  it('retrieves official Patiala, Punjab administrative boundaries and localities', () => {
    const data = getPatialaLocalities();
    expect(data.city).toBe('Patiala');
    expect(data.district).toBe('Patiala');
    expect(data.state).toBe('Punjab');
    expect(data.country).toBe('India');
    expect(data.parliamentaryConstituency).toBe('13 - Patiala');
    expect(data.assemblyConstituencies).toContain('115 - Patiala Urban');
    expect(data.assemblyConstituencies).toContain('110 - Patiala Rural');
    expect(data.assemblyConstituencies).toContain('116 - Samana');
    expect(data.pinCodes).toContain('147001');
    expect(data.pinCodes).toContain('147002');
    expect(data.pinCodes).toContain('147004');

    expect(data.localities.length).toBeGreaterThanOrEqual(15);
    const modelTown = data.localities.find((l) => l.id === 'model_town');
    expect(modelTown).toBeDefined();
    expect(modelTown.pinCode).toBe('147001');
    expect(modelTown.assemblyConstituency).toBe('115 - Patiala Urban');

    const urbanEstate = data.localities.find((l) => l.id === 'urban_estate_2');
    expect(urbanEstate).toBeDefined();
    expect(urbanEstate.pinCode).toBe('147002');
  });

  it('filters Patiala addresses by search query', () => {
    const results = searchPatialaAddresses({ query: 'Model Town' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].components.locality).toBe('Model Town');
    expect(results[0].components.city).toBe('Patiala');
    expect(results[0].components.state).toBe('Punjab');
    expect(results[0].components.pinCode).toBe('147001');
  });

  it('filters Patiala addresses by specific PIN code (147002 for Urban Estate & University)', () => {
    const results = searchPatialaAddresses({ pinCode: '147002' });
    expect(results.length).toBeGreaterThanOrEqual(2);
    results.forEach((r) => {
      expect(r.components.pinCode).toBe('147002');
      expect(r.components.city).toBe('Patiala');
      expect(r.components.state).toBe('Punjab');
    });
  });

  it('autocompletes Patiala queries and prioritizes Punjab addresses', async () => {
    const suggestions = await autocompleteAddress('Leela Bhawan');
    expect(suggestions.length).toBeGreaterThan(0);

    const match = suggestions.find((s) => s.description.includes('Patiala'));
    expect(match).toBeDefined();
    expect(match.description).toContain('Patiala, Punjab');

    const details = await getPlaceDetails(match.placeId);
    expect(details.city).toBe('Patiala');
    expect(details.district).toBe('Patiala');
    expect(details.state).toBe('Punjab');
    expect(details.country).toBe('India');
    expect(details.pinCode).toBe('147001');
  });

  it('dynamically maps unlisted user addresses in Patiala and retains parsed street and house number in getPlaceDetails', async () => {
    const customSuggestions = await autocompleteAddress('House 55, Near Gurdwara, Patiala');
    expect(customSuggestions.length).toBeGreaterThan(0);

    const first = customSuggestions[0];
    expect(first.components.city).toBe('Patiala');
    expect(first.components.district).toBe('Patiala');
    expect(first.components.state).toBe('Punjab');
    expect(first.components.country).toBe('India');
    expect(first.components.pinCode).toBe('147001');
    expect(first.components.houseNumber).toBe('55');

    // Ensure getPlaceDetails remembers and returns the custom address components
    const resolved = await getPlaceDetails(first.placeId);
    expect(resolved.city).toBe('Patiala');
    expect(resolved.houseNumber).toBe('55');
    expect(resolved.street).toContain('Near Gurdwara');
    expect(resolved.pinCode).toBe('147001');
  });

  it('correctly maps Google Places API detail payloads to ElectionDesk address schema', () => {
    const mockGooglePayload = {
      name: 'Punjabi University',
      formatted_address: 'NH-7, Urban Estate Phase 2, Patiala, Punjab 147002, India',
      address_components: [
        { long_name: 'NH-7', short_name: 'NH-7', types: ['route'] },
        { long_name: 'Urban Estate Phase 2', short_name: 'Urban Estate Phase 2', types: ['sublocality_level_1', 'sublocality'] },
        { long_name: 'Patiala', short_name: 'Patiala', types: ['locality'] },
        { long_name: 'Patiala', short_name: 'Patiala', types: ['administrative_area_level_2'] },
        { long_name: 'Punjab', short_name: 'PB', types: ['administrative_area_level_1'] },
        { long_name: 'India', short_name: 'IN', types: ['country'] },
        { long_name: '147002', short_name: '147002', types: ['postal_code'] },
      ],
      geometry: {
        location: { lat: 30.3585, lng: 76.4475 },
      },
    };

    const parsed = parseGooglePlaceDetails(mockGooglePayload);
    expect(parsed.city).toBe('Patiala');
    expect(parsed.district).toBe('Patiala');
    expect(parsed.state).toBe('Punjab');
    expect(parsed.pinCode).toBe('147002');
    expect(parsed.locality).toBe('Urban Estate Phase 2');
    expect(parsed.street).toBe('NH-7');
    expect(parsed.latitude).toBe(30.3585);
    expect(parsed.longitude).toBe(76.4475);
    expect(parsed.country).toBe('India');
  });

  it('searches newly added Patiala hubs like Passy Road, Civil Lines, and Bahadurgarh Fort', async () => {
    const passyResults = await autocompleteAddress('Passy Road');
    expect(passyResults.length).toBeGreaterThan(0);
    expect(passyResults[0].description).toContain('Passy Road');
    expect(passyResults[0].description).toContain('Patiala, Punjab');

    const civilLinesResults = await autocompleteAddress('Civil Lines');
    expect(civilLinesResults.length).toBeGreaterThan(0);
    expect(civilLinesResults[0].description).toContain('Civil Lines');

    const fortResults = await autocompleteAddress('Bahadurgarh');
    expect(fortResults.length).toBeGreaterThan(0);
    expect(fortResults[0].description).toContain('Bahadurgarh');
  });

  it('verifies seeded Patiala polling stations and voters exist in database', async () => {
    const patialaBooths = await dbStore.pollingStations.find({ district: 'Patiala' });
    expect(patialaBooths.length).toBeGreaterThanOrEqual(3);

    const booth42 = patialaBooths.find((b) => b.officialBoothNumber === '42');
    expect(booth42).toBeDefined();
    expect(booth42.assemblyConstituency).toBe('115 - Patiala Urban');
    expect(booth42.electoralArea).toBe('Ward 12');

    const patialaVoters = await dbStore.voters.find({ 'address.city': 'Patiala' });
    expect(patialaVoters.length).toBeGreaterThanOrEqual(4);

    const harpreet = patialaVoters.find((v) => v.epicNumber === 'PB1049281');
    expect(harpreet).toBeDefined();
    expect(harpreet.fullName).toBe('Harpreet Singh Sandhu');
    expect(harpreet.address.state).toBe('Punjab');
    expect(harpreet.address.city).toBe('Patiala');
    expect(harpreet.address.pinCode).toBe('147001');
  });
});
