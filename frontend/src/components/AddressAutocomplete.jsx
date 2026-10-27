import React, { useState, useEffect, useRef } from 'react';
import { placesApi } from '../api/client';
import {
  isGoogleMapsLoaded,
  PATIALA_BOUNDS,
  PATIALA_CENTER,
  extractGoogleComponents,
} from '../utils/googleMapsLoader';
import LocationPickerMap from './LocationPickerMap';
import {
  MapPin,
  Search,
  CheckCircle,
  AlertCircle,
  Edit3,
  ExternalLink,
  Sparkles,
  Map,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Compass,
} from 'lucide-react';

const PATIALA_PRESETS = [
  { label: 'Indra Colony', placeId: 'ChIJ_Patiala_IndraColony_21', pin: '147001' },
  { label: 'New Mehar Singh Colony', placeId: 'ChIJ_Patiala_NewMeharSinghColony_22', pin: '147001' },
  { label: 'Harinder Nagar', placeId: 'ChIJ_Patiala_HarinderNagar_23', pin: '147001' },
  { label: 'Maharana Narinder Enclave', placeId: 'ChIJ_Patiala_MaharanaNarinderEnclave_24', pin: '147001' },
  { label: 'Harman Colony', placeId: 'ChIJ_Patiala_HarmanColony_25', pin: '147001' },
  { label: 'Green Park Colony', placeId: 'ChIJ_Patiala_GreenParkColony_26', pin: '147001' },
  { label: 'Indrapuri', placeId: 'ChIJ_Patiala_Indrapuri_27', pin: '147001' },
  { label: 'Basant Vihar', placeId: 'ChIJ_Patiala_BasantVihar_28', pin: '147001' },
  { label: 'Model Town', placeId: 'ChIJ_Patiala_ModelTown_01', pin: '147001' },
  { label: 'Leela Bhawan', placeId: 'ChIJ_Patiala_LeelaBhawan_02', pin: '147001' },
  { label: 'Urban Estate Ph 2', placeId: 'ChIJ_Patiala_UrbanEstatePhase2_03', pin: '147002' },
  { label: 'Urban Estate Ph 1', placeId: 'ChIJ_Patiala_UrbanEstatePhase1_04', pin: '147002' },
  { label: 'Punjabi University', placeId: 'ChIJ_Patiala_PunjabiUniversity_05', pin: '147002' },
  { label: 'Baradari Gardens', placeId: 'ChIJ_Patiala_BaradariGardens_06', pin: '147001' },
  { label: 'Tripuri Town', placeId: 'ChIJ_Patiala_Tripuri_07', pin: '147001' },
  { label: 'Thapar Campus', placeId: 'ChIJ_Patiala_ThaparCampus_08', pin: '147004' },
  { label: 'Civil Lines', placeId: 'ChIJ_Patiala_CivilLines_18', pin: '147001' },
  { label: 'Passy Road', placeId: 'ChIJ_Patiala_PassyRoad_19', pin: '147001' },
  { label: 'SST Nagar', placeId: 'ChIJ_Patiala_SSTNagar_11', pin: '147001' },
  { label: 'Qila Mubarak', placeId: 'ChIJ_Patiala_QilaMubarak_09', pin: '147001' },
  { label: 'Nabha Town', placeId: 'ChIJ_Patiala_Nabha_15', pin: '147201' },
  { label: 'Rajpura Town', placeId: 'ChIJ_Patiala_Rajpura_16', pin: '140401' },
  { label: 'Samana Town', placeId: 'ChIJ_Patiala_Samana_17', pin: '147101' },
];

export function AddressAutocomplete({ value, onChange, errors = {} }) {
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [addressSource, setAddressSource] = useState(() => {
    if (value?.placeId && value?.verified) return 'google';
    if (value?.formattedAddress) return 'manual';
    return 'initial';
  });

  const dropdownRef = useRef(null);
  const autocompleteServiceRef = useRef(null);

  // Address fields state defaulting to Patiala, Punjab
  const address = value || {
    houseNumber: '',
    street: '',
    locality: '',
    villageWard: '12',
    city: 'Patiala',
    district: 'Patiala',
    state: 'Punjab',
    pinCode: '147001',
    country: 'India',
    verified: false,
    latitude: null,
    longitude: null,
    formattedAddress: '',
    placeId: null,
  };

  // Populate search input if value already has a formatted address, but never overwrite form data
  useEffect(() => {
    if (value?.formattedAddress && !searchInput) {
      setSearchInput(value.formattedAddress);
    }
  }, [value?.formattedAddress]);

  const handleFieldChange = (field, val) => {
    setAddressSource('manual');
    onChange({
      ...address,
      [field]: val,
      verified: field === 'verified' ? val : address.verified,
    });
  };

  // Debounced places search using Google Places client service when available or backend proxy
  useEffect(() => {
    if (!searchInput || searchInput.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);

        // 1. If Google Maps Places AutocompleteService is loaded, query client-side
        if (isGoogleMapsLoaded() && window.google?.maps?.places?.AutocompleteService) {
          if (!autocompleteServiceRef.current) {
            autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
          }

          try {
            const predictions = await new Promise((resolve) => {
              autocompleteServiceRef.current.getPlacePredictions(
                {
                  input: searchInput,
                  componentRestrictions: { country: 'in' },
                  locationBias: new window.google.maps.LatLngBounds(
                    new window.google.maps.LatLng(PATIALA_BOUNDS.south, PATIALA_BOUNDS.west),
                    new window.google.maps.LatLng(PATIALA_BOUNDS.north, PATIALA_BOUNDS.east)
                  ),
                },
                (results, status) => {
                  if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                    resolve(results);
                  } else {
                    resolve([]);
                  }
                }
              );
            });

            if (predictions && predictions.length > 0) {
              const formatted = predictions.map((p) => ({
                placeId: p.place_id,
                description: p.description,
                mainText: p.structured_formatting?.main_text || p.description,
                secondaryText: p.structured_formatting?.secondary_text || '',
                isGoogleDirect: true,
              }));
              setSuggestions(formatted);
              setShowDropdown(true);
              return;
            }
          } catch (e) {
            // Fall back to backend places API
          }
        }

        // 2. Fallback to ElectionDesk verified Patiala backend API proxy
        const res = await placesApi.autocomplete(searchInput);
        setSuggestions(res.data.data || []);
        setShowDropdown(true);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = async (suggestion) => {
    setShowDropdown(false);
    setSearchInput(suggestion.description);
    setAddressSource('google');

    // 1. Immediately apply components attached to suggestion (prevents lost fields)
    if (suggestion.components) {
      onChange({
        ...address,
        ...suggestion.components,
        formattedAddress: suggestion.description,
        placeId: suggestion.placeId,
        verified: true,
        lastVerifiedAt: new Date().toISOString(),
      });
    }

    // 2. Fetch full structured details from backend / Google Places Details API
    try {
      if (suggestion.placeId) {
        const detailsRes = await placesApi.getDetails(suggestion.placeId);
        const comps = detailsRes.data?.data;
        if (comps && (comps.city || comps.locality || comps.latitude)) {
          onChange({
            ...address,
            ...(suggestion.components || {}),
            ...comps,
            formattedAddress: suggestion.description,
            placeId: suggestion.placeId,
            latitude: comps.latitude ?? address.latitude,
            longitude: comps.longitude ?? address.longitude,
            verified: true,
            lastVerifiedAt: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      // Components already populated from suggestion
    }
  };

  const handleSelectPreset = async (preset) => {
    try {
      setAddressSource('preset');
      const detailsRes = await placesApi.getDetails(preset.placeId);
      const comps = detailsRes.data?.data || {};
      const streetOrLabel = comps.street || preset.label;
      const formatted = `${streetOrLabel}, Patiala, Punjab ${comps.pinCode || preset.pin}`;
      setSearchInput(formatted);
      onChange({
        ...address,
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: preset.pin,
        ...comps,
        formattedAddress: formatted,
        placeId: preset.placeId,
        verified: true,
        lastVerifiedAt: new Date().toISOString(),
      });
    } catch (err) {
      onChange({
        ...address,
        locality: preset.label,
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: preset.pin,
        verified: true,
      });
    }
  };

  // Callback when pin is adjusted on the interactive map
  const handleMapPinChange = ({ latitude, longitude, addressDetails, formattedAddress }) => {
    const updated = {
      ...address,
      latitude,
      longitude,
    };
    if (addressDetails) {
      if (addressDetails.houseNumber && !address.houseNumber) updated.houseNumber = addressDetails.houseNumber;
      if (addressDetails.street && !address.street) updated.street = addressDetails.street;
      if (addressDetails.locality && !address.locality) updated.locality = addressDetails.locality;
      if (addressDetails.villageWard && !address.villageWard) updated.villageWard = addressDetails.villageWard;
      if (addressDetails.pinCode && !address.pinCode) updated.pinCode = addressDetails.pinCode;
    }
    if (formattedAddress && !address.formattedAddress) {
      updated.formattedAddress = formattedAddress;
    }
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Patiala, Punjab Quick-Select Bar */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-amber-900 font-semibold">
          <span className="flex items-center space-x-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Patiala, Punjab — Address Quick Autofill</span>
          </span>
          <span className="text-[10px] bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded font-mono">
            PIN: 147001 - 147004
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {PATIALA_PRESETS.map((p) => (
            <button
              key={p.placeId}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className="inline-flex items-center space-x-1 text-[11px] bg-white hover:bg-amber-100 text-slate-800 border border-amber-200 px-2 py-1 rounded-md transition shadow-2xs font-medium cursor-pointer"
            >
              <MapPin className="h-2.5 w-2.5 text-amber-600" />
              <span>{p.label}</span>
              <span className="text-[9px] text-slate-400">({p.pin})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Places Autocomplete Search Bar */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Search Official Address (Google Places & Patiala Registry)
          </label>

          {/* Distinction Badge: Clearly distinguishes Google-suggested from manual */}
          {addressSource === 'google' && (
            <span className="inline-flex items-center text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              <CheckCircle className="h-3 w-3 mr-1 text-emerald-600" />
              Google Places Suggested
            </span>
          )}
          {addressSource === 'preset' && (
            <span className="inline-flex items-center text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
              <Compass className="h-3 w-3 mr-1 text-blue-600" />
              Patiala Preset
            </span>
          )}
          {addressSource === 'manual' && (
            <span className="inline-flex items-center text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
              <Edit3 className="h-3 w-3 mr-1 text-amber-600" />
              Manually Entered / Modified
            </span>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setAddressSource('manual');
            }}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            placeholder="Search Model Town, Leela Bhawan, Urban Estate, Passy Road, or any Patiala address..."
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-base sm:text-sm text-slate-900 placeholder-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
          {isSearching && (
            <span className="absolute right-3 top-3 text-xs text-slate-400 animate-pulse">Searching...</span>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {showDropdown && suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-sm shadow-xl ring-1 ring-black ring-opacity-5 border border-slate-200">
            {suggestions.map((s) => {
              const isPatiala =
                (s.description || '').toLowerCase().includes('patiala') ||
                (s.secondaryText || '').toLowerCase().includes('patiala') ||
                (s.secondaryText || '').toLowerCase().includes('punjab');

              return (
                <li
                  key={s.placeId}
                  onClick={() => handleSelectSuggestion(s)}
                  className="cursor-pointer px-4 py-2.5 hover:bg-slate-50 flex items-start space-x-2 text-slate-700 border-b border-slate-50 last:border-b-0"
                >
                  <MapPin
                    className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                      isPatiala ? 'text-amber-600' : 'text-brand-600'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">{s.mainText}</span>
                      <div className="flex items-center space-x-1">
                        {s.isGoogleDirect && (
                          <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                            Google
                          </span>
                        )}
                        {isPatiala && (
                          <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            Patiala, Punjab
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">{s.secondaryText || s.description}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Action Bar: Toggle Map & Toggle Manual Overrides */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 gap-2">
        <span className="flex items-center">
          <AlertCircle className="h-3.5 w-3.5 text-amber-500 mr-1.5 flex-shrink-0" />
          <span>Synced with Patiala, Punjab electoral boundaries & postal directories.</span>
        </span>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setShowMapPreview(!showMapPreview)}
            className="text-brand-600 font-medium hover:underline flex items-center cursor-pointer"
          >
            <Map className="h-3.5 w-3.5 mr-1" />
            <span>{showMapPreview ? 'Hide Map' : 'Preview / Pin on Map'}</span>
            {showMapPreview ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={() => setIsManualOverride(!isManualOverride)}
            className="text-slate-700 font-medium hover:underline flex items-center cursor-pointer"
          >
            <Edit3 className="h-3 w-3 mr-1" />
            {isManualOverride ? 'Hide Fields' : 'Edit Components'}
          </button>
        </div>
      </div>

      {/* Interactive Map Preview & Pin Placement */}
      {showMapPreview && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Interactive Location Picker & Map Pin</span>
            <span className="text-[11px] text-slate-500">
              Click anywhere on the map or drag the marker to adjust coordinates
            </span>
          </div>
          <LocationPickerMap
            latitude={address.latitude}
            longitude={address.longitude}
            onChange={handleMapPinChange}
            height="260px"
            showSearch={true}
            allowGeolocation={true}
            helperText="Coordinates are stored securely and used solely for electoral constituency and polling station administration."
          />
        </div>
      )}

      {/* Structured Address Components Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">House / Door No.</label>
          <input
            type="text"
            value={address.houseNumber || ''}
            onChange={(e) => handleFieldChange('houseNumber', e.target.value)}
            placeholder="e.g. 142-A or SCO 24"
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Street / Road</label>
          <input
            type="text"
            value={address.street || ''}
            onChange={(e) => handleFieldChange('street', e.target.value)}
            placeholder="e.g. Model Town Main Road"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Locality / Area</label>
          <input
            type="text"
            value={address.locality || ''}
            onChange={(e) => handleFieldChange('locality', e.target.value)}
            placeholder="e.g. Model Town / Leela Bhawan"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Village / Ward</label>
          <input
            type="text"
            value={address.villageWard || ''}
            onChange={(e) => handleFieldChange('villageWard', e.target.value)}
            placeholder="e.g. Ward 14"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            City <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={address.city || ''}
            onChange={(e) => handleFieldChange('city', e.target.value)}
            placeholder="e.g. Patiala"
            className={`w-full rounded-md border px-3 py-2 text-base sm:text-sm focus:outline-none ${
              errors['address.city'] ? 'border-rose-400' : 'border-slate-300 focus:border-brand-600'
            }`}
          />
          {errors['address.city'] && (
            <p className="text-xs text-rose-500 mt-0.5">{errors['address.city']}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            District <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={address.district || ''}
            onChange={(e) => handleFieldChange('district', e.target.value)}
            placeholder="e.g. Patiala"
            className={`w-full rounded-md border px-3 py-2 text-base sm:text-sm focus:outline-none ${
              errors['address.district'] ? 'border-rose-400' : 'border-slate-300 focus:border-brand-600'
            }`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            State <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={address.state || ''}
            onChange={(e) => handleFieldChange('state', e.target.value)}
            placeholder="e.g. Punjab"
            className={`w-full rounded-md border px-3 py-2 text-base sm:text-sm focus:outline-none ${
              errors['address.state'] ? 'border-rose-400' : 'border-slate-300 focus:border-brand-600'
            }`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            PIN Code (6 Digits) <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={6}
            value={address.pinCode || ''}
            onChange={(e) => handleFieldChange('pinCode', e.target.value)}
            placeholder="e.g. 147001"
            className={`w-full rounded-md border px-3 py-2 text-base sm:text-sm focus:outline-none font-mono ${
              errors['address.pinCode'] ? 'border-rose-400' : 'border-slate-300 focus:border-brand-600'
            }`}
          />
          {errors['address.pinCode'] && (
            <p className="text-xs text-rose-500 mt-0.5">{errors['address.pinCode']}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Country</label>
          <input
            type="text"
            disabled
            value={address.country || 'India'}
            className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-base sm:text-sm text-slate-500 cursor-not-allowed"
          />
        </div>

        <div className="flex items-center pt-5">
          <label className="relative flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(address.verified)}
              onChange={(e) => handleFieldChange('verified', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            <span className="ml-2 text-xs font-medium text-slate-700">Officially Verified Address</span>
          </label>
        </div>
      </div>
    </div>
  );
}

export default AddressAutocomplete;
