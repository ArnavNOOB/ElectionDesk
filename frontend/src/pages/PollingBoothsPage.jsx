import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { boothApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import LocationPickerMap from '../components/LocationPickerMap';
import StatusBadge from '../components/StatusBadge';
import ErrorBoundary from '../components/ErrorBoundary';
import { geocodeAddressUtil } from '../utils/googleMapsLoader';
import {
  MapPin,
  Plus,
  Search,
  Users,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Edit2,
  Building,
  Map as MapIcon,
  List as ListIcon,
  Columns,
  Compass,
  Sparkles,
  RefreshCw,
  Filter,
} from 'lucide-react';

export function PollingBoothsPage() {
  const { canManageBooths } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [constituencyFilter, setConstituencyFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'map' | 'list'
  const [selectedBoothId, setSelectedBoothId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBooth, setEditingBooth] = useState(null);

  const [formData, setFormData] = useState({
    officialBoothNumber: '',
    stationName: '',
    electoralArea: 'Ward 12',
    assemblyConstituency: '115 - Patiala Urban',
    parliamentaryConstituency: '13 - Patiala',
    district: 'Patiala',
    address: '',
    status: 'Active',
    location: {
      latitude: 30.3398,
      longitude: 76.3869,
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [error, setError] = useState('');

  // Fetch summary and list
  const { data: summaryData } = useQuery({
    queryKey: ['booth-summary'],
    queryFn: async () => {
      const res = await boothApi.summary();
      return res?.data?.data || {};
    },
  });

  const { data: rawBooths = [], refetch } = useQuery({
    queryKey: ['booths-list', searchTerm],
    queryFn: async () => {
      const res = await boothApi.list({ search: searchTerm });
      const d = res?.data?.data;
      return Array.isArray(d) ? d : [];
    },
  });

  const boothsList = useMemo(() => (Array.isArray(rawBooths) ? rawBooths : []), [rawBooths]);

  // Filter booths
  const filteredBooths = useMemo(() => {
    const list = boothsList.filter((b) => {
      if (!b) return false;
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (constituencyFilter !== 'ALL' && b.assemblyConstituency !== constituencyFilter) return false;
      return true;
    });
    return list.sort((a, b) => {
      const numA = String(a?.officialBoothNumber ?? '').trim();
      const numB = String(b?.officialBoothNumber ?? '').trim();
      return numA.localeCompare(numB, undefined, { numeric: true });
    });
  }, [boothsList, statusFilter, constituencyFilter]);

  // Extract unique constituencies for filter dropdown
  const constituencies = useMemo(() => {
    const set = new Set();
    boothsList.forEach((b) => {
      if (b?.assemblyConstituency) set.add(b.assemblyConstituency);
    });
    return Array.from(set);
  }, [boothsList]);

  // Map markers representation
  const mapMarkers = useMemo(() => {
    return filteredBooths
      .filter((b) => {
        const lat = Number(b?.location?.latitude);
        const lng = Number(b?.location?.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
      })
      .map((b) => ({
        id: b._id || b.id || `station-${b.officialBoothNumber}`,
        latitude: Number(b.location.latitude),
        longitude: Number(b.location.longitude),
        badge: b.officialBoothNumber,
        title: b.stationName || `Station #${b.officialBoothNumber}`,
        subtitle: `${b.electoralArea || 'Ward 12'} — ${b.address || ''}`,
        data: {
          voterCount: Number(b.voterCount) || 0,
          assemblyConstituency: b.assemblyConstituency || '115 - Patiala Urban',
          status: b.status || 'Active',
          booth: b,
        },
      }));
  }, [filteredBooths]);

  const metrics = useMemo(() => {
    const raw = summaryData && typeof summaryData === 'object' ? summaryData : {};
    return {
      totalBooths: raw.totalBooths ?? boothsList.length,
      activeBooths: raw.activeBooths ?? boothsList.filter((b) => b?.status === 'Active').length,
      totalAssignedVoters: raw.totalAssignedVoters ?? boothsList.reduce((acc, b) => acc + (Number(b?.voterCount) || 0), 0),
      averageVotersPerBooth: raw.averageVotersPerBooth ?? 0,
    };
  }, [summaryData, boothsList]);

  const handleOpenCreate = () => {
    setEditingBooth(null);
    setFormData({
      officialBoothNumber: '',
      stationName: '',
      electoralArea: 'Ward 12',
      assemblyConstituency: '115 - Patiala Urban',
      parliamentaryConstituency: '13 - Patiala',
      district: 'Patiala',
      address: '',
      status: 'Active',
      location: {
        latitude: 30.3398,
        longitude: 76.3869,
      },
    });
    setError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (booth) => {
    setEditingBooth(booth);
    setFormData({
      officialBoothNumber: booth.officialBoothNumber || '',
      stationName: booth.stationName || '',
      electoralArea: booth.electoralArea || 'Ward 12',
      assemblyConstituency: booth.assemblyConstituency || '115 - Patiala Urban',
      parliamentaryConstituency: booth.parliamentaryConstituency || '13 - Patiala',
      district: booth.district || 'Patiala',
      address: booth.address || '',
      status: booth.status || 'Active',
      location: {
        latitude: booth.location?.latitude !== null && booth.location?.latitude !== undefined ? Number(booth.location.latitude) : 30.3398,
        longitude: booth.location?.longitude !== null && booth.location?.longitude !== undefined ? Number(booth.location.longitude) : 76.3869,
      },
    });
    setError('');
    setModalOpen(true);
  };

  // Helper to geocode address inside modal
  const handleGeocodeModalAddress = async () => {
    if (!formData.address.trim()) return;
    try {
      setIsGeocodingAddress(true);
      setError('');
      const fullQuery = `${formData.address}, ${formData.district || 'Patiala'}, Punjab`;
      const result = await geocodeAddressUtil(fullQuery);
      if (result && result.latitude && result.longitude) {
        setFormData((prev) => ({
          ...prev,
          location: {
            latitude: result.latitude,
            longitude: result.longitude,
          },
        }));
      } else {
        setError('Could not locate address coordinates. You can click on the map to pin manually.');
      }
    } catch (err) {
      setError(`Geocoding error: ${err.message}`);
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError('');

      const payload = {
        ...formData,
        location: {
          latitude:
            formData.location?.latitude !== null && formData.location?.latitude !== undefined && formData.location?.latitude !== ''
              ? Number(formData.location.latitude)
              : null,
          longitude:
            formData.location?.longitude !== null && formData.location?.longitude !== undefined && formData.location?.longitude !== ''
              ? Number(formData.location.longitude)
              : null,
        },
      };

      if (editingBooth) {
        await boothApi.update(editingBooth._id || editingBooth.id, payload);
      } else {
        await boothApi.create(payload);
      }

      setModalOpen(false);
      refetch();
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Polling Stations & Electoral Area Management
          </h1>
          <p className="text-xs text-slate-500">
            Official Election Commission polling station registry, spatial coordinates, and voter roll allocations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Mode Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-slate-600 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`inline-flex items-center space-x-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition ${
                viewMode === 'split' ? 'bg-brand-600 text-white shadow-2xs' : 'hover:bg-slate-100'
              }`}
              title="Side-by-side List & Map"
            >
              <Columns className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center space-x-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition ${
                viewMode === 'map' ? 'bg-brand-600 text-white shadow-2xs' : 'hover:bg-slate-100'
              }`}
              title="Full Map View"
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>Map</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center space-x-1 rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition ${
                viewMode === 'list' ? 'bg-brand-600 text-white shadow-2xs' : 'hover:bg-slate-100'
              }`}
              title="Cards List View"
            >
              <ListIcon className="h-3.5 w-3.5" />
              <span>List</span>
            </button>
          </div>

          {canManageBooths && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center justify-center space-x-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-500 min-h-[36px] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Polling Booth</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Stations</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalBooths || boothsList.length}</div>
        </div>

        <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Active Stations</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{metrics.activeBooths || boothsList.length}</div>
        </div>

        <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Assigned Electorate</span>
          <div className="text-2xl font-bold text-brand-600 mt-1">{metrics.totalAssignedVoters || 0}</div>
        </div>

        <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Avg Voters / Booth</span>
          <div className="text-2xl font-bold text-slate-800 mt-1">{metrics.averageVotersPerBooth || 0}</div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by booth number, school name, or ward..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-brand-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {constituencies.length > 0 && (
            <select
              value={constituencyFilter}
              onChange={(e) => setConstituencyFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-brand-600 focus:outline-none"
            >
              <option value="ALL">All Constituencies</option>
              {constituencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-brand-600 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Under_Review">Under Review</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Synchronized Content: Split, Map, or List View */}
      {viewMode === 'map' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Displaying <strong className="text-slate-800">{mapMarkers.length}</strong> geocoded polling stations on
              Google Maps Platform. Click any station marker to inspect electoral details.
            </span>
          </div>
          <ErrorBoundary compact title="Interactive Map Module Unavailable">
            <LocationPickerMap
              readOnly={true}
              height="560px"
              markers={mapMarkers}
              selectedMarkerId={selectedBoothId}
              onMarkerSelect={(m) => setSelectedBoothId(m.id)}
              helperText="Privacy & Security baseline: Markers reflect verified official polling stations and aggregate elector counts. Individual voter residences are never exposed publicly."
            />
          </ErrorBoundary>
        </div>
      )}

      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Synchronized Left List */}
          <div className="lg:col-span-5 space-y-3 max-h-[620px] overflow-y-auto pr-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Polling Stations ({filteredBooths.length})</span>
              {selectedBoothId && (
                <button
                  type="button"
                  onClick={() => setSelectedBoothId(null)}
                  className="text-brand-600 hover:underline text-[11px] normal-case"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {filteredBooths.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-400">
                No polling stations found matching the filter criteria.
              </div>
            ) : (
              filteredBooths.map((b) => {
                const id = b._id || b.id;
                const isSelected = selectedBoothId === id;
                const hasCoords = b.location?.latitude && b.location?.longitude;

                return (
                  <div
                    key={id}
                    onClick={() => setSelectedBoothId(id)}
                    className={`rounded-xl bg-white p-4 border transition cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'border-brand-500 ring-2 ring-brand-100 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded border border-brand-200">
                            Booth #{b.officialBoothNumber}
                          </span>
                          <StatusBadge status={b.status || 'Active'} />
                          {hasCoords ? (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-mono">
                              GPS Active
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                              No GPS
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-xs text-slate-900 mt-1.5 line-clamp-2">{b.stationName}</h3>
                      </div>

                      {canManageBooths && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(b);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600 flex items-start">
                      <MapPin className="h-3 w-3 text-slate-400 mr-1.5 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{b.address}</span>
                    </p>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-medium text-slate-700">{b.electoralArea}</span>
                      <span className="font-mono font-semibold text-slate-800 flex items-center">
                        <Users className="h-3 w-3 mr-1 text-brand-600" />
                        {b.voterCount || 0} electors
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Synchronized Right Interactive Map */}
          <div className="lg:col-span-7 sticky top-4 space-y-2">
            <ErrorBoundary compact title="Interactive Map Module Unavailable">
              <LocationPickerMap
                readOnly={true}
                height="580px"
                markers={mapMarkers}
                selectedMarkerId={selectedBoothId}
                onMarkerSelect={(m) => setSelectedBoothId(m.id)}
                helperText="Markers synchronize in real-time with search queries and list selection."
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBooths.map((b) => {
            const id = b._id || b.id;
            const hasCoords = b.location?.latitude && b.location?.longitude;
            return (
              <div key={id} className="rounded-xl bg-white p-5 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-sm bg-brand-50 text-brand-700 px-2 py-0.5 rounded border border-brand-200">
                        Booth #{b.officialBoothNumber}
                      </span>
                      <StatusBadge status={b.status || 'Active'} />
                      {hasCoords && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">
                          GPS: {Number(b.location.latitude).toFixed(4)}, {Number(b.location.longitude).toFixed(4)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm text-slate-900 mt-2">{b.stationName}</h3>
                  </div>

                  {canManageBooths && (
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(b)}
                      className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-600 flex items-start">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 mr-1.5 flex-shrink-0 mt-0.5" />
                  <span>{b.address}</span>
                </p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{b.assemblyConstituency}</span>
                  <span className="font-mono font-semibold text-slate-800 flex items-center">
                    <Users className="h-3 w-3 mr-1 text-brand-600" />
                    {b.voterCount || 0} registered electors
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Booth Modal with Location Picker Map */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              {editingBooth ? `Edit Polling Station #${editingBooth.officialBoothNumber}` : 'Add New Polling Station'}
            </h3>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Official Booth Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.officialBoothNumber}
                    onChange={(e) => setFormData({ ...formData, officialBoothNumber: e.target.value })}
                    placeholder="e.g. 42, 43, 44, 45"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs focus:border-brand-600 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Electoral Area / Ward <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.electoralArea}
                    onChange={(e) => setFormData({ ...formData, electoralArea: e.target.value })}
                    placeholder="e.g. Ward 14, Model Town & Passi Road"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Station Name (School / Public Venue) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.stationName}
                  onChange={(e) => setFormData({ ...formData, stationName: e.target.value })}
                  placeholder="e.g. Government Multipurpose Senior Secondary School, Room 1"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Assembly Constituency</label>
                  <input
                    type="text"
                    required
                    value={formData.assemblyConstituency}
                    onChange={(e) => setFormData({ ...formData, assemblyConstituency: e.target.value })}
                    placeholder="e.g. 115 - Patiala Urban"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Parliamentary Constituency</label>
                  <input
                    type="text"
                    required
                    value={formData.parliamentaryConstituency}
                    onChange={(e) => setFormData({ ...formData, parliamentaryConstituency: e.target.value })}
                    placeholder="e.g. 13 - Patiala"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">District</label>
                  <input
                    type="text"
                    required
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    placeholder="e.g. Patiala"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-700">
                    Physical Address <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeocodeModalAddress}
                    disabled={isGeocodingAddress || !formData.address.trim()}
                    className="text-brand-600 hover:underline inline-flex items-center text-[11px] font-medium disabled:opacity-50 cursor-pointer"
                  >
                    <Compass className="h-3 w-3 mr-1 text-brand-600" />
                    <span>{isGeocodingAddress ? 'Locating...' : 'Pin from Physical Address'}</span>
                  </button>
                </div>
                <textarea
                  required
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Complete street address of the polling venue (e.g. Passi Road, Near Model Town, Patiala, Punjab 147001)"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs focus:border-brand-600 focus:outline-none"
                />
              </div>

              {/* Geographic Coordinates & Interactive Map Picker */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 flex items-center">
                    <MapPin className="h-3.5 w-3.5 mr-1 text-brand-600" />
                    <span>Geographic Coordinates & Map Marker Placement</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Click map or drag the pin to set precise booth venue
                  </span>
                </div>

                <ErrorBoundary compact title="Map Coordinate Selector Unavailable">
                  <LocationPickerMap
                    latitude={formData.location?.latitude}
                    longitude={formData.location?.longitude}
                    onChange={({ latitude, longitude }) => {
                      setFormData((prev) => ({
                        ...prev,
                        location: { latitude, longitude },
                      }));
                    }}
                    height="220px"
                    showSearch={true}
                    allowGeolocation={true}
                  />
                </ErrorBoundary>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs focus:border-brand-600 focus:outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Under_Review">Under Review</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-500 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving Station...' : 'Save Polling Station'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PollingBoothsPage;
