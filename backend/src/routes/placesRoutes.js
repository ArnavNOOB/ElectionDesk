import { Router } from 'express';
import {
  handlePlacesAutocomplete,
  handlePlaceDetails,
  handleGetPatialaLocalities,
  handleSearchPatiala,
  handleGetPatialaSummary,
  handleGeocodeAddress,
  handleReverseGeocode,
} from '../controllers/placesController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Dedicated Patiala, Punjab Address API routes
router.get('/patiala', requireAuth, handleGetPatialaSummary);
router.get('/patiala/localities', requireAuth, handleGetPatialaLocalities);
router.get('/patiala/search', requireAuth, handleSearchPatiala);

// Standard Google Places compatible autocomplete, details, and geocoding
router.get('/autocomplete', requireAuth, handlePlacesAutocomplete);
router.get('/details/:placeId', requireAuth, handlePlaceDetails);
router.get('/geocode', requireAuth, handleGeocodeAddress);
router.post('/geocode', requireAuth, handleGeocodeAddress);
router.get('/reverse-geocode', requireAuth, handleReverseGeocode);
router.post('/reverse-geocode', requireAuth, handleReverseGeocode);

export default router;
