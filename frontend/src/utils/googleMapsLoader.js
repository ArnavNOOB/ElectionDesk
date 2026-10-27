import { useState, useEffect } from 'react';
import { placesApi } from '../api/client';

// Patiala, Punjab administrative geographic coordinates
export const PATIALA_CENTER = {
  lat: 30.3398,
  lng: 76.3869,
};

export const PATIALA_BOUNDS = {
  north: 30.4500,
  south: 30.2200,
  east: 76.5000,
  west: 76.2800,
};

let googleMapsScriptPromise = null;
let googleMapsAuthError = null;
const authErrorListeners = new Set();

export function subscribeToMapsAuthError(callback) {
  authErrorListeners.add(callback);
  return () => authErrorListeners.delete(callback);
}

/**
 * Checks if the Google Maps JavaScript API is already fully loaded in the window
 */
export function isGoogleMapsLoaded() {
  return (
    typeof window !== 'undefined' &&
    !googleMapsAuthError &&
    Boolean(
      window.google &&
      window.google.maps &&
      window.google.maps.Map &&
      window.google.maps.Marker
    )
  );
}

/**
 * Singleton Google Maps API Loader
 * Injects the script only once, avoids duplicate script tags, and handles failures
 */
export function loadGoogleMaps(apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
  if (isGoogleMapsLoaded()) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsAuthError) {
    return Promise.reject(new Error(googleMapsAuthError));
  }

  if (!apiKey || apiKey.includes('YOUR_') || apiKey.trim() === '') {
    return Promise.reject(new Error('Google Maps API key is missing or unconfigured.'));
  }

  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    // Intercept Google Maps Authentication / Billing Failure
    window.gm_authFailure = () => {
      const errMsg =
        'Google Maps Platform authentication failure. Please check API key restrictions, billing status, and enabled APIs in Google Cloud Console.';
      googleMapsAuthError = errMsg;
      console.warn(`[GoogleMapsLoader] ${errMsg}`);
      authErrorListeners.forEach((cb) => {
        try {
          cb(errMsg);
        } catch (e) {
          console.error(e);
        }
      });
      reject(new Error(errMsg));
    };

    // Check if script element already exists in DOM
    const existingScript = document.querySelector('script[data-google-maps-loader="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.google?.maps) resolve(window.google.maps);
        else reject(new Error('Google Maps script loaded but window.google.maps is undefined.'));
      });
      existingScript.addEventListener('error', (e) => {
        reject(new Error('Failed to load Google Maps script tag.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey.trim()
    )}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-google-maps-loader', 'true');

    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps script loaded but maps object is unavailable.'));
      }
    };

    script.onerror = (err) => {
      googleMapsScriptPromise = null;
      reject(new Error('Network error loading Google Maps JavaScript API. Please check internet connectivity.'));
    };

    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

/**
 * Custom React hook for Google Maps Platform availability
 */
export function useGoogleMaps() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [status, setStatus] = useState(() => {
    if (isGoogleMapsLoaded()) return 'ready';
    if (!apiKey || apiKey.includes('YOUR_')) return 'unconfigured';
    return 'loading';
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    if (isGoogleMapsLoaded()) {
      setStatus('ready');
      return;
    }

    if (!apiKey || apiKey.includes('YOUR_')) {
      setStatus('unconfigured');
      setError('Google Maps API key not set in environment (VITE_GOOGLE_MAPS_API_KEY).');
      return;
    }

    setStatus('loading');
    loadGoogleMaps(apiKey)
      .then(() => {
        if (mounted) {
          setStatus('ready');
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          setStatus('error');
          setError(err.message || 'Failed to load Google Maps.');
        }
      });

    const unsubscribeAuth = subscribeToMapsAuthError((errMsg) => {
      if (mounted) {
        setStatus('error');
        setError(errMsg);
      }
    });

    return () => {
      mounted = false;
      unsubscribeAuth();
    };
  }, [apiKey]);

  return {
    isReady: status === 'ready',
    isLoading: status === 'loading',
    isError: status === 'error' || status === 'unconfigured',
    status,
    error,
    google: typeof window !== 'undefined' ? window.google : null,
  };
}

/**
 * Geocode an address using client-side Google Maps Geocoder if loaded, or fallback to backend API
 */
export async function geocodeAddressUtil(addressString) {
  if (!addressString || !addressString.trim()) {
    throw new Error('Address string is required for geocoding.');
  }

  // 1. Client-side Google Maps Geocoder
  if (isGoogleMapsLoaded() && window.google.maps.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode(
          {
            address: addressString,
            componentRestrictions: { country: 'IN' },
            bounds: new window.google.maps.LatLngBounds(
              new window.google.maps.LatLng(PATIALA_BOUNDS.south, PATIALA_BOUNDS.west),
              new window.google.maps.LatLng(PATIALA_BOUNDS.north, PATIALA_BOUNDS.east)
            ),
          },
          (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
              resolve(results[0]);
            } else {
              reject(new Error(`Geocoder returned status: ${status}`));
            }
          }
        );
      });

      if (result) {
        const lat = result.geometry.location.lat();
        const lng = result.geometry.location.lng();
        const components = extractGoogleComponents(result);
        return {
          formattedAddress: result.formatted_address,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          components,
          source: 'GOOGLE_MAPS_JS_GEOCODER',
        };
      }
    } catch (e) {
      console.warn('[GoogleMapsLoader] Client geocoder failed, falling back to server API:', e.message);
    }
  }

  // 2. Server API fallback
  const res = await placesApi.geocode(addressString);
  return res.data?.data;
}

/**
 * Reverse geocode numeric coordinates using client-side Google Geocoder or backend API
 */
export async function reverseGeocodeUtil(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    throw new Error('Valid numeric coordinates required.');
  }

  // 1. Client-side Google Maps Geocoder
  if (isGoogleMapsLoaded() && window.google.maps.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results && results.length > 0) {
            resolve(results[0]);
          } else {
            reject(new Error(`Reverse geocoder status: ${status}`));
          }
        });
      });

      if (result) {
        const components = extractGoogleComponents(result);
        return {
          formattedAddress: result.formatted_address,
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          components,
          source: 'GOOGLE_MAPS_JS_REVERSE_GEOCODER',
        };
      }
    } catch (e) {
      console.warn('[GoogleMapsLoader] Client reverse geocode failed, falling back to server API:', e.message);
    }
  }

  // 2. Server API fallback
  const res = await placesApi.reverseGeocode(lat, lng);
  return res.data?.data;
}

/**
 * Helper to extract standardized ElectionDesk address schema from Google geocode / place result
 */
export function extractGoogleComponents(result) {
  const components = result?.address_components || [];
  const getComp = (types) => {
    const found = components.find((c) => types.some((t) => c.types.includes(t)));
    return found ? found.long_name : '';
  };

  const houseNumber = getComp(['street_number', 'premise', 'subpremise']);
  const route = getComp(['route', 'street_address']);
  const neighborhood = getComp(['neighborhood']);
  const sublocality = getComp(['sublocality_level_1', 'sublocality']);
  const villageWard = getComp(['sublocality_level_2', 'administrative_area_level_3']) || '12';
  const locality = sublocality || neighborhood || '';
  let city = getComp(['locality', 'postal_town']) || 'Patiala';
  let district = getComp(['administrative_area_level_2']) || 'Patiala';
  let state = getComp(['administrative_area_level_1']) || 'Punjab';
  let pinCode = getComp(['postal_code']) || '147001';
  const country = getComp(['country']) || 'India';

  const lat = result.geometry?.location
    ? typeof result.geometry.location.lat === 'function'
      ? result.geometry.location.lat()
      : result.geometry.location.lat
    : null;

  const lng = result.geometry?.location
    ? typeof result.geometry.location.lng === 'function'
      ? result.geometry.location.lng()
      : result.geometry.location.lng
    : null;

  return {
    houseNumber,
    street: route,
    locality,
    villageWard,
    city,
    district,
    state,
    pinCode: pinCode.replace(/\D/g, '').slice(0, 6),
    country,
    latitude: lat !== null ? Number(Number(lat).toFixed(6)) : null,
    longitude: lng !== null ? Number(Number(lng).toFixed(6)) : null,
    formattedAddress: result.formatted_address || '',
    placeId: result.place_id || null,
  };
}
