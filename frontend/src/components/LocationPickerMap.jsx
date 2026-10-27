import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  useGoogleMaps,
  PATIALA_CENTER,
  PATIALA_BOUNDS,
  geocodeAddressUtil,
  reverseGeocodeUtil,
} from '../utils/googleMapsLoader';
import {
  MapPin,
  Search,
  Navigation,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  AlertTriangle,
  Compass,
  CheckCircle2,
  Layers,
  Info,
} from 'lucide-react';

/**
 * Reusable Google Map Component supporting:
 * 1. Single-point location picker with draggable marker and click-to-pin
 * 2. Multi-point Polling Booths visualizer with synchronized markers & InfoWindows
 * 3. Integrated address geocoder search
 * 4. User-consented device geolocation ("Locate Me")
 * 5. Robust offline / error fallback with manual coordinate fields
 */
export function LocationPickerMap({
  latitude = null,
  longitude = null,
  onChange,
  readOnly = false,
  height = '360px',
  markers = [], // Array of { id, latitude, longitude, title, subtitle, badge, data }
  selectedMarkerId = null,
  onMarkerSelect,
  showSearch = true,
  allowGeolocation = true,
  helperText,
  zoom = 13,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const singleMarkerRef = useRef(null);
  const multiMarkersMapRef = useRef(new Map());
  const infoWindowRef = useRef(null);

  const { isReady, isLoading, isError, error } = useGoogleMaps();

  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [userLocating, setUserLocating] = useState(false);
  const [currentCoords, setCurrentCoords] = useState({
    lat: latitude !== null && !isNaN(Number(latitude)) ? Number(latitude) : null,
    lng: longitude !== null && !isNaN(Number(longitude)) ? Number(longitude) : null,
  });

  // Keep internal coordinates in sync when external props change
  useEffect(() => {
    if (latitude !== null && longitude !== null && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
      setCurrentCoords({ lat: Number(latitude), lng: Number(longitude) });
      if (singleMarkerRef.current && mapInstanceRef.current && window.google?.maps?.LatLng) {
        try {
          const newPos = new window.google.maps.LatLng(Number(latitude), Number(longitude));
          singleMarkerRef.current.setPosition(newPos);
        } catch (e) {
          console.warn('[LocationPickerMap] Could not set marker position', e);
        }
      }
    }
  }, [latitude, longitude]);

  // Center coordinates logic: prefer currentCoords -> first marker -> Patiala center
  const getInitialCenter = useCallback(() => {
    if (currentCoords.lat !== null && currentCoords.lng !== null) {
      return { lat: currentCoords.lat, lng: currentCoords.lng };
    }
    if (markers && markers.length > 0 && markers[0].latitude && markers[0].longitude) {
      return { lat: Number(markers[0].latitude), lng: Number(markers[0].longitude) };
    }
    return PATIALA_CENTER;
  }, [currentCoords, markers]);

  // Initialize Map Instance when Google Maps API is ready
  useEffect(() => {
    if (!isReady || !mapContainerRef.current || !window.google?.maps?.Map) return;

    try {
      const center = getInitialCenter();

      if (!mapInstanceRef.current) {
        const map = new window.google.maps.Map(mapContainerRef.current, {
          center,
          zoom: zoom || 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
          restriction: {
            latLngBounds: {
              north: 32.5,
              south: 28.5,
              east: 78.5,
              west: 74.0,
            },
            strictBounds: false,
          },
        });

        if (window.google.maps.InfoWindow) {
          infoWindowRef.current = new window.google.maps.InfoWindow();
        }

        // Click on map to place/move location marker (if not readOnly)
        if (!readOnly && onChange) {
          map.addListener('click', async (e) => {
            const clickedLat = Number(e.latLng.lat().toFixed(6));
            const clickedLng = Number(e.latLng.lng().toFixed(6));
            setCurrentCoords({ lat: clickedLat, lng: clickedLng });

            if (singleMarkerRef.current) {
              singleMarkerRef.current.setPosition(e.latLng);
            } else {
              createSingleMarker(map, e.latLng);
            }

            // Trigger reverse geocoding to suggest address components
            try {
              const rev = await reverseGeocodeUtil(clickedLat, clickedLng);
              onChange({
                latitude: clickedLat,
                longitude: clickedLng,
                addressDetails: rev?.components || null,
                formattedAddress: rev?.formattedAddress || '',
              });
            } catch {
              onChange({ latitude: clickedLat, longitude: clickedLng });
            }
          });
        }

        mapInstanceRef.current = map;
      }
    } catch (err) {
      console.warn('[LocationPickerMap] Map initialization error:', err);
    }
  }, [isReady, readOnly, onChange, getInitialCenter, zoom]);

  // Helper to create single draggable location marker
  const createSingleMarker = (map, position) => {
    try {
      if (singleMarkerRef.current) {
        singleMarkerRef.current.setMap(null);
      }

      if (!window.google?.maps?.Marker) return;

      const hasSymbol = Boolean(window.google?.maps?.SymbolPath?.BACKWARD_CLOSED_ARROW);
      const hasAnim = Boolean(window.google?.maps?.Animation?.DROP);

      const marker = new window.google.maps.Marker({
        position,
        map,
        draggable: !readOnly,
        animation: hasAnim ? window.google.maps.Animation.DROP : undefined,
        title: 'Selected Electoral Location',
        icon: hasSymbol
          ? {
              path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
              scale: 6,
              fillColor: '#0284c7', // Brand blue
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: '#ffffff',
            }
          : undefined,
      });

      if (!readOnly && onChange) {
        marker.addListener('dragend', async (e) => {
          const newLat = Number(e.latLng.lat().toFixed(6));
          const newLng = Number(e.latLng.lng().toFixed(6));
          setCurrentCoords({ lat: newLat, lng: newLng });

          try {
            const rev = await reverseGeocodeUtil(newLat, newLng);
            onChange({
              latitude: newLat,
              longitude: newLng,
              addressDetails: rev?.components || null,
              formattedAddress: rev?.formattedAddress || '',
            });
          } catch {
            onChange({ latitude: newLat, longitude: newLng });
          }
        });
      }

      singleMarkerRef.current = marker;
    } catch (err) {
      console.warn('[LocationPickerMap] Single marker error:', err);
    }
  };

  // Sync single marker position
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current || !window.google?.maps?.LatLng) return;
    if (markers.length === 0) {
      if (currentCoords.lat !== null && currentCoords.lng !== null) {
        try {
          const pos = new window.google.maps.LatLng(currentCoords.lat, currentCoords.lng);
          if (singleMarkerRef.current) {
            singleMarkerRef.current.setPosition(pos);
          } else {
            createSingleMarker(mapInstanceRef.current, pos);
          }
        } catch (e) {
          console.warn('[LocationPickerMap] Position sync error:', e);
        }
      }
    }
  }, [isReady, currentCoords, markers]);

  // Multi-marker support (for Polling Booths visualizer)
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current || !window.google?.maps?.Marker || !markers || markers.length === 0) return;

    try {
      const map = mapInstanceRef.current;
      const existingMarkers = multiMarkersMapRef.current;
      const currentMarkerIds = new Set(markers.map((m) => m.id));

      // Remove obsolete markers
      for (const [id, marker] of existingMarkers.entries()) {
        if (!currentMarkerIds.has(id)) {
          marker.setMap(null);
          existingMarkers.delete(id);
        }
      }

      const bounds = window.google?.maps?.LatLngBounds ? new window.google.maps.LatLngBounds() : null;
      let validMarkersCount = 0;

      markers.forEach((m) => {
        const lat = Number(m.latitude);
        const lng = Number(m.longitude);
        if (isNaN(lat) || isNaN(lng) || lat === 0) return;

        const pos = new window.google.maps.LatLng(lat, lng);
        if (bounds) bounds.extend(pos);
        validMarkersCount++;

        let marker = existingMarkers.get(m.id);
        const isSelected = selectedMarkerId === m.id;

        const hasCircle = Boolean(window.google?.maps?.SymbolPath?.CIRCLE);
        const iconConfig = hasCircle
          ? {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: isSelected ? 10 : 8,
              fillColor: isSelected ? '#ea580c' : '#0284c7', // Orange if selected, Brand blue otherwise
              fillOpacity: 0.95,
              strokeWeight: 2,
              strokeColor: '#ffffff',
            }
          : undefined;

        if (!marker) {
          marker = new window.google.maps.Marker({
            position: pos,
            map,
            title: `${m.badge ? `[${m.badge}] ` : ''}${m.title || 'Polling Booth'}`,
            label: m.badge
              ? {
                  text: String(m.badge).slice(-4),
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 'bold',
                }
              : undefined,
            icon: iconConfig,
          });

          marker.addListener('click', () => {
            if (infoWindowRef.current && window.google?.maps?.InfoWindow) {
              infoWindowRef.current.setContent(`
                <div style="font-family: ui-sans-serif, system-ui; max-width: 240px; padding: 4px;">
                  <div style="font-size: 11px; font-weight: bold; color: #0284c7; text-transform: uppercase;">
                    ${m.badge ? `Booth #${m.badge}` : 'Polling Station'}
                  </div>
                  <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px;">
                    ${m.title || ''}
                  </div>
                  <div style="font-size: 11px; color: #475569; margin-top: 4px;">
                    ${m.subtitle || ''}
                  </div>
                  ${
                    m.data?.voterCount !== undefined
                      ? `<div style="font-size: 11px; font-weight: 600; color: #059669; margin-top: 6px;">
                          👥 ${m.data.voterCount} Registered Electors
                        </div>`
                      : ''
                  }
                </div>
              `);
              infoWindowRef.current.open(map, marker);
            }

            if (onMarkerSelect) {
              onMarkerSelect(m);
            }
          });

          existingMarkers.set(m.id, marker);
        } else {
          marker.setPosition(pos);
          if (iconConfig) {
            marker.setIcon(iconConfig);
          }
        }
      });

      // Fit bounds if we have multiple valid markers and no single selected marker
      if (bounds && validMarkersCount > 1 && !selectedMarkerId && map.fitBounds) {
        map.fitBounds(bounds, 40);
      } else if (selectedMarkerId) {
        const selected = markers.find((m) => m.id === selectedMarkerId);
        if (selected && selected.latitude && selected.longitude && map.panTo) {
          map.panTo({ lat: Number(selected.latitude), lng: Number(selected.longitude) });
          if (map.setZoom) map.setZoom(15);
        }
      }
    } catch (err) {
      console.warn('[LocationPickerMap] Multi-marker rendering error:', err);
    }
  }, [isReady, markers, selectedMarkerId, onMarkerSelect]);

  // Handle address geocoding search
  const handleAddressSearch = async (e) => {
    e?.preventDefault();
    if (!addressSearchQuery.trim()) return;

    try {
      setIsGeocoding(true);
      setGeoError('');
      const result = await geocodeAddressUtil(addressSearchQuery);

      if (result && result.latitude && result.longitude) {
        const newCoords = { lat: result.latitude, lng: result.longitude };
        setCurrentCoords(newCoords);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(newCoords);
          mapInstanceRef.current.setZoom(15);
        }

        if (onChange) {
          onChange({
            latitude: result.latitude,
            longitude: result.longitude,
            addressDetails: result.components || null,
            formattedAddress: result.formattedAddress || addressSearchQuery,
          });
        }
      } else {
        setGeoError('Address not found. Please try a different query or click the map directly.');
      }
    } catch (err) {
      setGeoError(err.message || 'Geocoding failed.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Explicit user-triggered geolocation ("Locate Me")
  // Adheres to requirement: "Does not request the user's device location unless user explicitly chooses"
  const handleRequestUserLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setUserLocating(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setUserLocating(false);
        const deviceLat = Number(pos.coords.latitude.toFixed(6));
        const deviceLng = Number(pos.coords.longitude.toFixed(6));
        const newCoords = { lat: deviceLat, lng: deviceLng };
        setCurrentCoords(newCoords);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(newCoords);
          mapInstanceRef.current.setZoom(16);
        }

        try {
          const rev = await reverseGeocodeUtil(deviceLat, deviceLng);
          if (onChange) {
            onChange({
              latitude: deviceLat,
              longitude: deviceLng,
              addressDetails: rev?.components || null,
              formattedAddress: rev?.formattedAddress || '',
            });
          }
        } catch {
          if (onChange) onChange({ latitude: deviceLat, longitude: deviceLng });
        }
      },
      (err) => {
        setUserLocating(false);
        setGeoError(`Location permission denied or unavailable (${err.message})`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Manual coordinate input change handlers
  const handleManualCoordChange = (type, val) => {
    const num = val === '' ? null : Number(val);
    const updated = {
      ...currentCoords,
      [type]: num,
    };
    setCurrentCoords(updated);

    if (
      updated.lat !== null &&
      updated.lng !== null &&
      !isNaN(updated.lat) &&
      !isNaN(updated.lng) &&
      updated.lat >= -90 &&
      updated.lat <= 90 &&
      updated.lng >= -180 &&
      updated.lng <= 180
    ) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo({ lat: updated.lat, lng: updated.lng });
      }
      if (onChange) {
        onChange({ latitude: updated.lat, longitude: updated.lng });
      }
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs flex flex-col">
      {/* Map Control Bar */}
      {showSearch && (
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2">
          <form onSubmit={handleAddressSearch} className="flex-1 min-w-[200px] flex items-center space-x-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={addressSearchQuery}
                onChange={(e) => setAddressSearchQuery(e.target.value)}
                placeholder="Search Patiala locality, street or landmark..."
                className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-brand-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isGeocoding || !addressSearchQuery.trim()}
              className="inline-flex items-center px-2.5 py-1.5 rounded-md bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 disabled:opacity-50 transition cursor-pointer"
            >
              {isGeocoding ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <span className="text-xs">Locate</span>
              )}
            </button>
          </form>

          {allowGeolocation && (
            <button
              type="button"
              onClick={handleRequestUserLocation}
              disabled={userLocating}
              title="Use current GPS location"
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition cursor-pointer"
            >
              <Navigation className={`h-3 w-3 text-brand-600 ${userLocating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Use Current Location</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.panTo(PATIALA_CENTER);
                mapInstanceRef.current.setZoom(13);
              }
            }}
            title="Reset to Patiala Urban Center"
            className="inline-flex items-center px-2 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-medium transition cursor-pointer"
          >
            <Compass className="h-3 w-3 mr-1 text-amber-600" />
            <span>Patiala Center</span>
          </button>
        </div>
      )}

      {/* Geocoding Error Notice */}
      {geoError && (
        <div className="px-3 py-1.5 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <span>{geoError}</span>
          <button
            type="button"
            onClick={() => setGeoError('')}
            className="text-rose-500 hover:text-rose-800 text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Map Canvas / State Fallbacks */}
      <div className="relative w-full" style={{ height }}>
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center space-y-2 z-10">
            <RefreshCw className="h-6 w-6 text-brand-600 animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading Google Maps Platform...</p>
          </div>
        )}

        {/* API Failure / Missing Key Fallback State */}
        {isError && (
          <div className="absolute inset-0 bg-slate-50/95 backdrop-blur-2xs flex flex-col p-4 text-center z-10 overflow-y-auto">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs mb-3 flex items-start space-x-2 text-left">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Google Maps Interactive Mode Offline / Restricted</span>
                <span className="text-[11px] text-amber-700">
                  {error || 'Google Maps API key is restricted or unverified. Tabular spatial coordinate mapping is active.'}
                </span>
              </div>
            </div>

            {markers && markers.length > 0 ? (
              <div className="text-left space-y-2 flex-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Geocoded Polling Stations ({markers.length})</span>
                  <span className="text-slate-400 font-normal normal-case">Click to highlight</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {markers.map((m) => {
                    const isSelected = selectedMarkerId === m.id;
                    return (
                      <div
                        key={m.id}
                        onClick={() => onMarkerSelect && onMarkerSelect(m)}
                        className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-100 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-brand-700 bg-brand-100/60 px-2 py-0.5 rounded">
                            Booth #{m.badge}
                          </span>
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">
                            {Number(m.latitude).toFixed(4)}, {Number(m.longitude).toFixed(4)}
                          </span>
                        </div>
                        <div className="font-semibold text-xs text-slate-800 mt-1 line-clamp-1">{m.title}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">{m.subtitle}</div>
                        {m.data?.voterCount !== undefined && (
                          <div className="text-[10px] text-slate-600 font-medium mt-1">
                            👥 {m.data.voterCount} registered electors
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-4">
                <Compass className="h-8 w-8 text-slate-400 mb-2" />
                <div className="font-semibold text-xs text-slate-800">Patiala Urban Reference Center</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">30.3398° N, 76.3869° E</div>
                <p className="text-[11px] text-slate-400 mt-2">Manual coordinate input fields below are active.</p>
              </div>
            )}
          </div>
        )}

        {/* Real Google Map Container */}
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Coordinates Status Bar & Manual Entry */}
      <div className="p-2.5 bg-slate-50/90 border-t border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center space-x-2 text-slate-600">
          <MapPin className="h-3.5 w-3.5 text-brand-600 flex-shrink-0" />
          {currentCoords.lat !== null && currentCoords.lng !== null ? (
            <span className="font-mono text-[11px] text-slate-800">
              <span className="font-medium text-slate-500">Lat:</span> {Number(currentCoords.lat).toFixed(6)} |{' '}
              <span className="font-medium text-slate-500">Lng:</span> {Number(currentCoords.lng).toFixed(6)}
            </span>
          ) : (
            <span className="text-slate-400 italic text-[11px]">
              {readOnly ? 'No geographic coordinates set' : 'Click on map or search address to place pin'}
            </span>
          )}
        </div>

        {/* Manual coordinate overrides if not readOnly */}
        {!readOnly && (
          <div className="flex items-center space-x-1.5 self-end sm:self-auto">
            <div className="flex items-center space-x-1">
              <span className="text-[10px] font-medium text-slate-500">Lat:</span>
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={currentCoords.lat ?? ''}
                onChange={(e) => handleManualCoordChange('lat', e.target.value)}
                placeholder="30.3398"
                className="w-20 px-1.5 py-0.5 rounded border border-slate-300 text-[11px] font-mono focus:border-brand-600 focus:outline-none"
              />
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-[10px] font-medium text-slate-500">Lng:</span>
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={currentCoords.lng ?? ''}
                onChange={(e) => handleManualCoordChange('lng', e.target.value)}
                placeholder="76.3869"
                className="w-20 px-1.5 py-0.5 rounded border border-slate-300 text-[11px] font-mono focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {helperText && (
        <div className="px-3 py-1.5 bg-slate-100/60 border-t border-slate-200 text-[11px] text-slate-500 flex items-center">
          <Info className="h-3 w-3 mr-1 text-slate-400 flex-shrink-0" />
          <span>{helperText}</span>
        </div>
      )}
    </div>
  );
}

export default LocationPickerMap;
