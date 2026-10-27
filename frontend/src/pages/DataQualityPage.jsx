import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { voterApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle,
  Users,
  Search,
  Eye,
  ArrowRight,
  ShieldAlert,
  MapPin,
  FileCheck,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export function DataQualityPage() {
  const { canEditVoter } = useAuth();
  const [selectedDuplicateVoter, setSelectedDuplicateVoter] = useState(null);
  const [comparisonCandidate, setComparisonCandidate] = useState(null);

  // Fetch flagged duplicate voters
  const { data: duplicateData, refetch: refetchDuplicates } = useQuery({
    queryKey: ['flagged-duplicates'],
    queryFn: async () => {
      const res = await voterApi.list({ verificationStatus: 'Flagged_Duplicate', limit: 50 });
      return res.data.data || [];
    },
  });

  // Fetch records with data quality flags (unassigned booth or invalid PIN)
  const { data: missingBoothData, refetch: refetchMissingBooth } = useQuery({
    queryKey: ['quality-missing-booth'],
    queryFn: async () => {
      const res = await voterApi.list({ dataQualityIssue: 'UNASSIGNED_POLLING_BOOTH', limit: 50 });
      return res.data.data || [];
    },
  });

  const { data: unverifiedAddressData } = useQuery({
    queryKey: ['quality-unverified-address'],
    queryFn: async () => {
      const res = await voterApi.list({ dataQualityIssue: 'UNVERIFIED_ADDRESS', limit: 50 });
      return res.data.data || [];
    },
  });

  const { data: unlinkedFamilyData } = useQuery({
    queryKey: ['quality-unlinked-family'],
    queryFn: async () => {
      const res = await voterApi.list({ dataQualityIssue: 'UNLINKED_FAMILY_MEMBER', limit: 50 });
      return res.data.data || [];
    },
  });

  const duplicates = duplicateData || [];
  const missingBooths = missingBoothData || [];
  const unverifiedAddresses = unverifiedAddressData || [];
  const unlinkedFamily = unlinkedFamilyData || [];

  const handleOpenComparison = async (voter) => {
    setSelectedDuplicateVoter(voter);
    try {
      const res = await voterApi.checkDuplicates(voter, voter._id || voter.id);
      const matches = res.data.data || [];
      if (matches.length > 0) {
        setComparisonCandidate(matches[0].candidate);
      } else {
        setComparisonCandidate(null);
      }
    } catch (err) {
      setComparisonCandidate(null);
    }
  };

  const handleResolveDuplicate = async (voterId, newStatus) => {
    try {
      await voterApi.update(voterId, { verificationStatus: newStatus });
      setSelectedDuplicateVoter(null);
      setComparisonCandidate(null);
      refetchDuplicates();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Resolution failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Data Quality & Duplicate Review</h1>
        <p className="text-xs text-slate-500">
          Supervised administrative review queue. Flagged duplicates and inconsistent records require human oversight before validation.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Flagged Duplicates</span>
            <div className="text-2xl font-bold text-rose-600 mt-1">{duplicates.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Pending human inspection</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Unassigned Booths</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">{missingBooths.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Missing official polling station</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <MapPin className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Unlinked Family (FM)</span>
            <div className="text-2xl font-bold text-purple-600 mt-1">{unlinkedFamily.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">FM missing Family Head (FH)</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Unverified Addresses</span>
            <div className="text-2xl font-bold text-slate-800 mt-1">{unverifiedAddresses.length}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Requires physical field verification</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <FileCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Section 1: Flagged Duplicates Queue */}
      <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <h2 className="text-sm font-semibold text-slate-900">Potential Duplicate Review Queue</h2>
          </div>
          <span className="text-xs text-slate-500">{duplicates.length} records awaiting resolution</span>
        </div>

        {duplicates.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="font-medium text-slate-700">No duplicate flags currently detected in database.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3 text-left">EPIC Number</th>
                  <th className="py-2.5 px-3 text-left">Full Name</th>
                  <th className="py-2.5 px-3 text-left">Relative Name</th>
                  <th className="py-2.5 px-3 text-left">Age / Gender</th>
                  <th className="py-2.5 px-3 text-left">City / Locality</th>
                  <th className="py-2.5 px-3 text-right">Human Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {duplicates.map((v) => {
                  const id = v._id || v.id;
                  return (
                    <tr key={id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-brand-700">
                        #{v.boothSerialNumber || '—'}
                        {v.epicNumber && <div className="text-[10px] text-slate-400 font-normal">{v.epicNumber}</div>}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{v.fullName}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {v.relativeName} ({v.relationType})
                      </td>
                      <td className="py-2.5 px-3">
                        {v.age} • {v.gender}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {v.address?.locality || v.address?.city}, {v.address?.pinCode}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenComparison(v)}
                          className="inline-flex items-center space-x-1 px-3 py-1 rounded-md bg-brand-50 text-brand-700 hover:bg-brand-100 font-medium"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Compare Matches</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Unassigned Polling Booths */}
      <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-900">Voters Missing Polling Station Assignment</h2>
          </div>
          <span className="text-xs text-slate-500">{missingBooths.length} records</span>
        </div>

        {missingBooths.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="font-medium text-slate-700">All registered voters are linked to verified polling booths.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3 text-left">EPIC ID</th>
                  <th className="py-2.5 px-3 text-left">Full Name</th>
                  <th className="py-2.5 px-3 text-left">Locality & District</th>
                  <th className="py-2.5 px-3 text-left">PIN Code</th>
                  <th className="py-2.5 px-3 text-right">Resolve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {missingBooths.map((v) => {
                  const id = v._id || v.id;
                  return (
                    <tr key={id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-brand-700">
                        #{v.boothSerialNumber || '—'}
                        {v.epicNumber && <div className="text-[10px] text-slate-400 font-normal">{v.epicNumber}</div>}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-900">{v.fullName}</td>
                      <td className="py-2 px-3">
                        {v.address?.locality || v.address?.city}, {v.address?.district}
                      </td>
                      <td className="py-2 px-3 font-mono">{v.address?.pinCode}</td>
                      <td className="py-2 px-3 text-right">
                        <NavLink
                          to={`/voters/${id}/edit`}
                          className="text-brand-600 hover:underline font-semibold"
                        >
                          Assign Booth →
                        </NavLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Side-by-Side Duplicate Comparison Modal */}
      {selectedDuplicateVoter && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Side-by-Side Duplicate Review</h3>
                <p className="text-xs text-slate-500">
                  Inspect the flagged record against the suspected duplicate candidate.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDuplicateVoter(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Record A */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-4 space-y-2 text-xs">
                <span className="font-semibold text-rose-800 uppercase tracking-wide block">
                  Flagged Record A (Subject)
                </span>
                <div className="font-bold text-sm text-slate-900">{selectedDuplicateVoter.fullName}</div>
                <div className="font-mono text-brand-700 font-bold">Booth Serial: #{selectedDuplicateVoter.boothSerialNumber || '—'} {selectedDuplicateVoter.epicNumber ? `(EPIC: ${selectedDuplicateVoter.epicNumber})` : ''}</div>
                <div>
                  Relative: <strong>{selectedDuplicateVoter.relativeName}</strong> (
                  {selectedDuplicateVoter.relationType})
                </div>
                <div>
                  Age/Gender: <strong>{selectedDuplicateVoter.age}</strong> yrs • {selectedDuplicateVoter.gender}
                </div>
                <div>
                  Address: {selectedDuplicateVoter.address?.houseNumber} {selectedDuplicateVoter.address?.street},{' '}
                  {selectedDuplicateVoter.address?.locality}, {selectedDuplicateVoter.address?.city}{' '}
                  <span className="font-mono font-semibold">{selectedDuplicateVoter.address?.pinCode}</span>
                </div>
              </div>

              {/* Record B */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 text-xs">
                <span className="font-semibold text-slate-600 uppercase tracking-wide block">
                  Matched Candidate B
                </span>
                {comparisonCandidate ? (
                  <>
                    <div className="font-bold text-sm text-slate-900">{comparisonCandidate.fullName}</div>
                    <div className="font-mono text-brand-700 font-bold">Booth Serial: #{comparisonCandidate.boothSerialNumber || '—'} {comparisonCandidate.epicNumber ? `(EPIC: ${comparisonCandidate.epicNumber})` : ''}</div>
                    <div>
                      Relative: <strong>{comparisonCandidate.relativeName}</strong> (
                      {comparisonCandidate.relationType})
                    </div>
                    <div>
                      Age/Gender: <strong>{comparisonCandidate.age}</strong> yrs • {comparisonCandidate.gender}
                    </div>
                    <div>
                      Address: {comparisonCandidate.address?.houseNumber} {comparisonCandidate.address?.street},{' '}
                      {comparisonCandidate.address?.locality}, {comparisonCandidate.address?.city}{' '}
                      <span className="font-mono font-semibold">{comparisonCandidate.address?.pinCode}</span>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center text-slate-400">
                    No exact secondary candidate currently in memory. The match was triggered during batch import.
                  </div>
                )}
              </div>
            </div>

            {/* Resolution Actions */}
            <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-xs text-slate-500">
                Action will be permanently recorded in the immutable audit log.
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleResolveDuplicate(selectedDuplicateVoter._id || selectedDuplicateVoter.id, 'Verified')}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"
                >
                  Verify as Legitimate (Dismiss Flag)
                </button>
                <button
                  type="button"
                  onClick={() => handleResolveDuplicate(selectedDuplicateVoter._id || selectedDuplicateVoter.id, 'Disputed')}
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-500"
                >
                  Confirm as Disputed / Duplicate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataQualityPage;
