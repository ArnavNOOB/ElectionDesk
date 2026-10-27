import {
  autocompleteAddress,
  getPlaceDetails,
  getPatialaLocalities,
  searchPatialaAddresses,
  geocodeAddress,
  reverseGeocodeCoordinates,
} from '../services/placesService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export async function handlePlacesAutocomplete(req, res, next) {
  try {
    const { input } = req.query;
    const suggestions = await autocompleteAddress(input || '');
    return ApiResponse.success(res, suggestions, 'Address suggestions retrieved');
  } catch (error) {
    next(error);
  }
}

export async function handlePlaceDetails(req, res, next) {
  try {
    const { placeId } = req.params;
    const details = await getPlaceDetails(placeId);
    return ApiResponse.success(res, details, 'Place address components retrieved');
  } catch (error) {
    next(error);
  }
}

/**
 * Dedicated API: Retrieve master administrative boundaries and localities of Patiala, Punjab
 */
export async function handleGetPatialaLocalities(req, res, next) {
  try {
    const data = getPatialaLocalities();
    return ApiResponse.success(res, data, 'Patiala, Punjab administrative localities retrieved');
  } catch (error) {
    next(error);
  }
}

/**
 * Dedicated API: Search Patiala addresses by query, PIN code, or ward
 */
export async function handleSearchPatiala(req, res, next) {
  try {
    const { query, pinCode, ward } = req.query;
    const results = searchPatialaAddresses({ query, pinCode, ward });
    return ApiResponse.success(res, results, `Found ${results.length} Patiala address records`);
  } catch (error) {
    next(error);
  }
}

/**
 * Dedicated API: Comprehensive summary of Patiala, Punjab constituency and polling metadata
 */
export async function handleGetPatialaSummary(req, res, next) {
  try {
    const data = getPatialaLocalities();
    return ApiResponse.success(
      res,
      {
        jurisdiction: 'Patiala District Administration, Punjab',
        city: data.city,
        state: data.state,
        pinCodes: data.pinCodes,
        assemblyConstituencies: data.assemblyConstituencies,
        parliamentaryConstituency: data.parliamentaryConstituency,
        localitiesCount: data.totalLocalities,
        sampleLocalities: data.localities.slice(0, 8),
      },
      'Patiala, Punjab jurisdiction summary retrieved'
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Geocode address to numeric coordinates and structured parts
 */
export async function handleGeocodeAddress(req, res, next) {
  try {
    const address = req.query.address || req.body?.address;
    if (!address) {
      return ApiResponse.error(res, 'Address query parameter is required', 400, 'INVALID_INPUT');
    }
    const result = await geocodeAddress(address);
    return ApiResponse.success(res, result, 'Address geocoded successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * Reverse geocode numeric coordinates to address
 */
export async function handleReverseGeocode(req, res, next) {
  try {
    const lat = req.query.lat ?? req.body?.latitude;
    const lng = req.query.lng ?? req.body?.longitude;

    if (lat === undefined || lng === undefined) {
      return ApiResponse.error(res, 'Both lat and lng parameters are required', 400, 'INVALID_COORDINATES');
    }

    const result = await reverseGeocodeCoordinates(Number(lat), Number(lng));
    return ApiResponse.success(res, result, 'Coordinates reverse geocoded successfully');
  } catch (error) {
    next(error);
  }
}
