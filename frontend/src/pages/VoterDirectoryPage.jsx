import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { voterApi, boothApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { NavLink } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit2,
  Archive,
  RefreshCw,
  Camera,
  MapPin,
  CheckCircle,
  Clock,
  AlertCircle,
  FileDown,
  Users,
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronUp,
  Phone,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import FamilyBadge from '../components/FamilyBadge';

export const APPROVED_LOCALITIES = [
  { value: 'indra colony', label: 'Indra Colony' },
  { value: 'new mehar singh colony', label: 'New Mehar Singh Colony' },
  { value: 'harinder nagar', label: 'Harinder Nagar' },
  { value: 'maharana narinder enclave', label: 'Maharana Narinder Enclave' },
  { value: 'harman colony', label: 'Harman Colony' },
  { value: 'green park colony', label: 'Green Park Colony' },
  { value: 'indrapuri', label: 'Indrapuri' },
  { value: 'basant vihar', label: 'Basant Vihar' },
];

export function VoterDirectoryPage() {
  const { canCreateVoter, canEditVoter, canArchiveVoter } = useAuth();

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedBooth, setSelectedBooth] = useState('');
  const [selectedLocality, setSelectedLocality] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedFamilyRole, setSelectedFamilyRole] = useState('');
  const [hasPhoto, setHasPhoto] = useState('');
  const [isArchived, setIsArchived] = useState(false);
  const [sortField, setSortField] = useState('boothSerialNumber');
  const [sortOrder, setSortOrder] = useState('asc');

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Archive modal state
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [targetVoter, setTargetVoter] = useState(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Active filters counter
  const activeFilterCount = [
    selectedBooth,
    selectedLocality,
    selectedStatus,
    selectedFamilyRole,
    hasPhoto,
    isArchived,
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSelectedBooth('');
    setSelectedLocality('');
    setSelectedStatus('');
    setSelectedFamilyRole('');
    setHasPhoto('');
    setIsArchived(false);
    setSearchTerm('');
    setDebouncedSearch('');
    setSortField('boothSerialNumber');
    setSortOrder('asc');
    setPage(1);
  };

  // Fetch booths for filter dropdown
  const { data: boothsData } = useQuery({
    queryKey: ['booths-list'],
    queryFn: async () => {
      const res = await boothApi.list();
      return res.data.data || [];
    },
  });

  // Fetch voters list
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'voters',
      page,
      debouncedSearch,
      selectedBooth,
      selectedLocality,
      selectedStatus,
      selectedFamilyRole,
      hasPhoto,
      isArchived,
      sortField,
      sortOrder,
    ],
    queryFn: async () => {
      const res = await voterApi.list({
        page,
        limit: 15,
        search: debouncedSearch,
        locality: selectedLocality || undefined,
        pollingStationId: selectedBooth || undefined,
        verificationStatus: selectedStatus || undefined,
        familyRole: selectedFamilyRole || undefined,
        hasPhoto: hasPhoto || undefined,
        isArchived,
        sortField,
        sortOrder,
      });
      return res.data;
    },
  });

  const voters = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 15, total: 0, totalPages: 1 };

  const handleArchiveConfirm = async () => {
    if (!targetVoter) return;
    try {
      setIsActionLoading(true);
      if (isArchived) {
        await voterApi.restore(targetVoter._id || targetVoter.id);
      } else {
        await voterApi.archive(targetVoter._id || targetVoter.id, archiveReason);
      }
      setArchiveModalOpen(false);
      setTargetVoter(null);
      setArchiveReason('');
      refetch();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Operation failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Page Title & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Official Voter Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Search, verify, and manage authorized electoral rolls with real-time field validation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {canCreateVoter && (
            <NavLink
              to="/voters/new"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-500 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Add Voter Record</span>
            </NavLink>
          )}
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="rounded-xl bg-white p-3.5 sm:p-4 shadow-sm border border-slate-200 space-y-3">
        {/* Search Row & Mobile Filter Button */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Debounced Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by booth serial #, voter name, mobile #, locality, or EPIC..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-9 text-base sm:text-xs text-slate-900 placeholder-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setDebouncedSearch('');
                  setPage(1);
                }}
                className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle Button */}
          <div className="flex items-center space-x-2 md:hidden">
            <button
              type="button"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition ${
                activeFilterCount > 0
                  ? 'bg-brand-50 border-brand-300 text-brand-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-brand-600 text-white font-bold">
                  {activeFilterCount}
                </span>
              )}
              {showMobileFilters ? (
                <ChevronUp className="h-3.5 w-3.5 ml-1 text-slate-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 ml-1 text-slate-400" />
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-2 text-xs font-medium text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Filter Dropdowns Grid: Hidden on mobile unless toggled open */}
        <div
          className={`${
            showMobileFilters ? 'grid' : 'hidden md:grid'
          } grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 pt-1`}
        >
          {/* Polling Booth Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1 md:hidden">Polling Station</label>
            <select
              value={selectedBooth}
              onChange={(e) => {
                setSelectedBooth(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-base sm:text-xs text-slate-700 focus:border-brand-600 focus:outline-none"
            >
              <option value="">All Polling Booths</option>
              {boothsData?.map((b) => (
                <option key={b._id || b.id} value={b._id || b.id}>
                  Booth #{b.officialBoothNumber} - {b.stationName.substring(0, 24)}...
                </option>
              ))}
            </select>
          </div>

          {/* Locality Dropdown Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1 md:hidden">Locality / Colony</label>
            <select
              value={selectedLocality}
              onChange={(e) => {
                setSelectedLocality(e.target.value);
                setPage(1);
              }}
              className={`w-full rounded-lg border py-2 px-3 text-base sm:text-xs focus:border-brand-600 focus:outline-none font-medium transition ${
                selectedLocality
                  ? 'border-brand-500 bg-brand-50/40 text-brand-900 font-semibold ring-1 ring-brand-500'
                  : 'border-slate-300 text-slate-700 bg-white'
              }`}
            >
              <option value="">All Localities / Colonies</option>
              {APPROVED_LOCALITIES.map((loc) => (
                <option key={loc.value} value={loc.value}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>

          {/* Family Notation Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1 md:hidden">Family Role</label>
            <select
              value={selectedFamilyRole}
              onChange={(e) => {
                setSelectedFamilyRole(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-base sm:text-xs text-slate-700 focus:border-brand-600 focus:outline-none font-medium"
            >
              <option value="">All Family Roles</option>
              <option value="FH">FH — Family Head</option>
              <option value="FM">FM — Family Member</option>
              <option value="SM">SM — Single Member</option>
            </select>
          </div>

          {/* Verification Status Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1 md:hidden">Verification Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-base sm:text-xs text-slate-700 focus:border-brand-600 focus:outline-none"
            >
              <option value="">All Verification Statuses</option>
              <option value="Verified">Verified</option>
              <option value="Pending_Verification">Pending Verification</option>
              <option value="Flagged_Duplicate">Flagged Duplicate</option>
              <option value="Disputed">Disputed</option>
            </select>
          </div>

          {/* Photo & Archived Quick Toggles */}
          <div className="flex items-center justify-between sm:justify-start space-x-3 px-1 py-1">
            <label className="flex items-center space-x-1.5 cursor-pointer text-xs text-slate-600 font-medium">
              <input
                type="checkbox"
                checked={hasPhoto === 'true'}
                onChange={(e) => {
                  setHasPhoto(e.target.checked ? 'true' : '');
                  setPage(1);
                }}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 sm:h-3.5 sm:w-3.5"
              />
              <span>Has Photo</span>
            </label>

            <span className="text-slate-300">|</span>

            <button
              type="button"
              onClick={() => {
                setIsArchived(!isArchived);
                setPage(1);
              }}
              className={`text-xs font-medium px-2 py-1 rounded transition ${
                isArchived
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {isArchived ? 'Archived Records' : 'View Archived'}
            </button>
          </div>
        </div>

        {/* Quick Locality Filter Chips */}
        <div className="pt-2 border-t border-slate-100 flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center flex-shrink-0 mr-1">
            <MapPin className="h-3 w-3 mr-1 text-brand-600" />
            Localities:
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedLocality('');
              setPage(1);
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex-shrink-0 ${
              !selectedLocality
                ? 'bg-brand-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Localities
          </button>
          {APPROVED_LOCALITIES.map((loc) => (
            <button
              key={loc.value}
              type="button"
              onClick={() => {
                setSelectedLocality(selectedLocality === loc.value ? '' : loc.value);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer flex-shrink-0 ${
                selectedLocality === loc.value
                  ? 'bg-brand-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {loc.label}
            </button>
          ))}
        </div>

        {/* Secondary Filter Badges & Sort Controls */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600 gap-2">
          <div className="flex items-center space-x-2">
            {activeFilterCount > 0 && (
              <span className="text-brand-700 font-medium bg-brand-50 border border-brand-200 px-2 py-0.5 rounded text-[11px]">
                {activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'}
              </span>
            )}
            {selectedLocality && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <MapPin className="h-3 w-3 text-emerald-600" />
                <span>Locality: {APPROVED_LOCALITIES.find((l) => l.value === selectedLocality)?.label}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLocality('');
                    setPage(1);
                  }}
                  className="ml-1 text-emerald-600 hover:text-emerald-900 font-bold"
                  title="Remove locality filter"
                >
                  ×
                </button>
              </span>
            )}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="hidden md:inline-block text-[11px] text-slate-400 hover:text-rose-600 underline"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 text-[11px] sm:text-xs">
            <span className="text-slate-400">Sort:</span>
            <button
              type="button"
              onClick={() => {
                setSortField('boothSerialNumber');
                setSortOrder(sortField === 'boothSerialNumber' && sortOrder === 'asc' ? 'desc' : 'asc');
              }}
              className={`hover:underline font-medium ${sortField === 'boothSerialNumber' ? 'text-brand-700 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-200' : 'text-slate-700'}`}
            >
              Serial #{sortField === 'boothSerialNumber' ? ` (${sortOrder === 'asc' ? '▲ 1-9' : '▼ 9-1'})` : ''}
            </button>
            <span className="text-slate-300">/</span>
            <button
              type="button"
              onClick={() => {
                setSortField('fullName');
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              }}
              className={`hover:underline font-medium ${sortField === 'fullName' ? 'text-brand-700 font-bold' : 'text-slate-700'}`}
            >
              Name ({sortField === 'fullName' ? sortOrder : 'off'})
            </button>
            <span className="text-slate-300">/</span>
            <button
              type="button"
              onClick={() => {
                setSortField('createdAt');
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              }}
              className={`hover:underline font-medium ${sortField === 'createdAt' ? 'text-brand-700 font-bold' : 'text-slate-700'}`}
            >
              Date ({sortField === 'createdAt' ? sortOrder : 'off'})
            </button>
          </div>
        </div>
      </div>

      {/* Voters List Container: Cards for mobile, Table for tablet & desktop */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent mx-auto mb-2" />
            Loading voter directory records...
          </div>
        ) : voters.length === 0 ? (
          <div className="py-16 text-center text-slate-400 px-4">
            <Users className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No voter records matched your criteria.</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search keywords or active filters.</p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-3 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 1. Mobile Cards View (Hidden on md and up) */}
            <div className="divide-y divide-slate-100 block md:hidden">
              {voters.map((voter) => {
                const id = voter._id || voter.id;
                const booth = voter.pollingStationId;
                return (
                  <div key={id} className="p-4 space-y-3 hover:bg-slate-50/60 transition">
                    {/* Header: Photo + Name + Booth Serial */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="h-11 w-11 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {voter.photoKey ? (
                            <img
                              src={voterApi.getPhotoUrl(id)}
                              alt="Thumbnail"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Camera className="h-5 w-5 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <NavLink
                              to={`/voters/${id}`}
                              className="font-semibold text-slate-900 hover:text-brand-600 text-sm truncate"
                            >
                              {voter.fullName}
                            </NavLink>
                            {voter.dataQualityFlags && voter.dataQualityFlags.length > 0 && (
                              <span title={voter.dataQualityFlags.join(', ')} className="text-amber-500 text-xs flex-shrink-0">
                                ⚠️
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {voter.age} yrs • {voter.gender}
                            {voter.relativeName ? ` • ${voter.relationType}: ${voter.relativeName}` : ''}
                          </div>
                          {voter.mobileNumber && (
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center">
                              <Phone className="h-3 w-3 mr-1 text-brand-600 flex-shrink-0" />
                              <a href={`tel:${voter.mobileNumber}`} className="hover:underline text-brand-700 font-semibold">
                                {voter.mobileNumber}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Booth Serial Badge */}
                      <div className="text-right flex-shrink-0">
                        <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs bg-brand-50 text-brand-800 border border-brand-200">
                          #{voter.boothSerialNumber || '—'}
                        </span>
                        {voter.epicNumber && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {voter.epicNumber}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Family & Status Row */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <FamilyBadge
                        role={voter.familyRole}
                        familyHead={voter.familyHead}
                        showHeadName={true}
                      />
                      <StatusBadge status={voter.isArchived ? 'Archived' : voter.verificationStatus} />
                    </div>

                    {/* Correlated Family Notice */}
                    {voter.matchedViaFamilyHead && (
                      <div className="text-[11px] text-purple-700 font-medium flex items-center bg-purple-50 px-2 py-1 rounded border border-purple-200">
                        <span className="mr-1">↳</span> Correlated Member of {voter.familyHead?.fullName || 'Family Head'}
                      </div>
                    )}

                    {/* Location Info */}
                    <div className="text-xs text-slate-500 flex items-center justify-between pt-1 border-t border-slate-50">
                      <div className="flex items-center space-x-1 truncate">
                        <MapPin className="h-3.5 w-3.5 text-brand-600 flex-shrink-0" />
                        <span className="truncate">
                          {booth ? `Booth #${booth.officialBoothNumber}` : 'Unassigned'} • {voter.address?.locality || voter.address?.city || '—'}, {voter.address?.pinCode}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons for Mobile Touch */}
                    <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100">
                      <NavLink
                        to={`/voters/${id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 min-h-[36px]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </NavLink>

                      {canEditVoter && !voter.isArchived && (
                        <NavLink
                          to={`/voters/${id}/edit`}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 min-h-[36px]"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </NavLink>
                      )}

                      {canArchiveVoter && (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetVoter(voter);
                            setArchiveModalOpen(true);
                          }}
                          className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] ${
                            isArchived
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {isArchived ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5" />
                              <span>Restore</span>
                            </>
                          ) : (
                            <>
                              <Archive className="h-3.5 w-3.5" />
                              <span>Archive</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Desktop Table View (Hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-left w-12">Photo</th>
                    <th
                      className="py-3 px-4 text-left cursor-pointer hover:text-brand-700 transition select-none"
                      onClick={() => {
                        setSortField('boothSerialNumber');
                        setSortOrder(sortField === 'boothSerialNumber' && sortOrder === 'asc' ? 'desc' : 'asc');
                      }}
                      title="Click to sort by Booth Serial Number"
                    >
                      <div className="flex items-center space-x-1">
                        <span>Booth Serial No.</span>
                        {sortField === 'boothSerialNumber' ? (
                          <span className="text-brand-600 font-bold text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <span className="text-slate-300 text-xs">↕</span>
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-left">Voter Full Name</th>
                    <th className="py-3 px-4 text-left">Family Role</th>
                    <th className="py-3 px-4 text-left">Relative Name</th>
                    <th className="py-3 px-4 text-left">Age / Gender</th>
                    <th className="py-3 px-4 text-left">Polling Booth</th>
                    <th className="py-3 px-4 text-left">Locality & City</th>
                    <th className="py-3 px-4 text-left">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {voters.map((voter) => {
                    const id = voter._id || voter.id;
                    const booth = voter.pollingStationId;
                    return (
                      <tr key={id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Photo Thumbnail */}
                        <td className="py-2.5 px-4">
                          <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                            {voter.photoKey ? (
                              <img
                                src={voterApi.getPhotoUrl(id)}
                                alt="Thumbnail"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Camera className="h-4 w-4 text-slate-300" />
                            )}
                          </div>
                        </td>

                        {/* Primary Booth Serial Number */}
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-xs bg-brand-50 text-brand-800 border border-brand-200">
                            #{voter.boothSerialNumber || '—'}
                          </span>
                          {voter.epicNumber && (
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              EPIC: {voter.epicNumber}
                            </div>
                          )}
                        </td>

                        {/* Full Name */}
                        <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                          <NavLink to={`/voters/${id}`} className="hover:text-brand-600 hover:underline">
                            {voter.fullName}
                          </NavLink>
                          {voter.dataQualityFlags && voter.dataQualityFlags.length > 0 && (
                            <span
                              title={voter.dataQualityFlags.join(', ')}
                              className="ml-1.5 inline-block text-amber-500 cursor-help"
                            >
                              ⚠️
                            </span>
                          )}
                          {voter.matchedViaFamilyHead && (
                            <div className="text-[10px] text-purple-700 font-medium flex items-center mt-0.5 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 w-fit">
                              <span className="mr-1">↳</span> Correlated Member of {voter.familyHead?.fullName || 'Family Head'}
                            </div>
                          )}
                          {voter.mobileNumber && (
                            <div className="text-[11px] text-slate-500 font-mono flex items-center mt-0.5">
                              <Phone className="h-2.5 w-2.5 mr-1 text-slate-400" />
                              <span>{voter.mobileNumber}</span>
                            </div>
                          )}
                        </td>

                        {/* Family Notation */}
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <FamilyBadge
                            role={voter.familyRole}
                            familyHead={voter.familyHead}
                            showHeadName={true}
                          />
                        </td>

                        {/* Relative Name */}
                        <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                          {voter.relativeName ? `${voter.relativeName} (${voter.relationType})` : '—'}
                        </td>

                        {/* Age / Gender */}
                        <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                          {voter.age} yrs • {voter.gender}
                        </td>

                        {/* Polling Booth */}
                        <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                          {booth ? (
                            <span className="inline-flex items-center text-slate-800 font-medium">
                              <MapPin className="h-3 w-3 mr-1 text-brand-600 flex-shrink-0" />
                              Booth #{booth.officialBoothNumber}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-medium italic">Unassigned</span>
                          )}
                        </td>

                        {/* Locality & PIN */}
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                          {voter.address?.locality || voter.address?.city || '—'}, {voter.address?.pinCode}
                        </td>

                        {/* Status Badge */}
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <StatusBadge status={voter.isArchived ? 'Archived' : voter.verificationStatus} />
                        </td>

                        {/* Quick Action Icons */}
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1.5">
                            <NavLink
                              to={`/voters/${id}`}
                              title="View Full Profile"
                              className="p-1.5 rounded text-slate-400 hover:text-brand-600 hover:bg-slate-100"
                            >
                              <Eye className="h-4 w-4" />
                            </NavLink>

                            {canEditVoter && !voter.isArchived && (
                              <NavLink
                                to={`/voters/${id}/edit`}
                                title="Edit Record"
                                className="p-1.5 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                              >
                                <Edit2 className="h-4 w-4" />
                              </NavLink>
                            )}

                            {canArchiveVoter && (
                              <button
                                onClick={() => {
                                  setTargetVoter(voter);
                                  setArchiveModalOpen(true);
                                }}
                                title={isArchived ? 'Restore Record' : 'Archive Record (Soft Delete)'}
                                className={`p-1.5 rounded ${
                                  isArchived
                                    ? 'text-emerald-600 hover:bg-emerald-50'
                                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                              >
                                {isArchived ? <RefreshCw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Server-Side Pagination Footer */}
        <Pagination pagination={pagination} onPageChange={(newPage) => setPage(newPage)} />
      </div>

      {/* Confirmation Dialog for Archival / Restoration */}
      <ConfirmDialog
        isOpen={archiveModalOpen}
        title={isArchived ? 'Restore Voter Record' : 'Archive Voter Record (Soft Delete)'}
        message={
          isArchived
            ? `Are you sure you want to restore voter "${targetVoter?.fullName}" (${targetVoter?.epicNumber || `Booth #${targetVoter?.boothSerialNumber}`}) back to the active electoral roll?`
            : `Are you sure you want to archive voter "${targetVoter?.fullName}" (${targetVoter?.epicNumber || `Booth #${targetVoter?.boothSerialNumber}`})? The record will be retired according to the approved 90-day retention schedule.`
        }
        confirmLabel={isArchived ? 'Restore Record' : 'Confirm Archival'}
        isDestructive={!isArchived}
        isLoading={isActionLoading}
        onConfirm={handleArchiveConfirm}
        onCancel={() => {
          setArchiveModalOpen(false);
          setTargetVoter(null);
        }}
      />
    </div>
  );
}

export default VoterDirectoryPage;
