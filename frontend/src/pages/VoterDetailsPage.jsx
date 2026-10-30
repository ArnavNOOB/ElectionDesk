import React, { useState } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { voterApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PhotoUploader from '../components/PhotoUploader';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import FamilyBadge from '../components/FamilyBadge';
import CallModal from '../components/CallModal';
import WhatsAppComposerModal from '../components/WhatsAppComposerModal';
import ConsentManagementModal from '../components/ConsentManagementModal';
import CommunicationHistoryTimeline from '../components/CommunicationHistoryTimeline';
import {
  ArrowLeft,
  Edit2,
  Archive,
  RefreshCw,
  MapPin,
  Calendar,
  Shield,
  AlertTriangle,
  Clock,
  User,
  Users,
  Home,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Phone,
  PhoneCall,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

export function VoterDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEditVoter, canArchiveVoter, canCommunicate } = useAuth();

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Communication Modals State
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [consentModalOpen, setConsentModalOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['voter-details', id],
    queryFn: async () => {
      const res = await voterApi.getById(id);
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading voter record details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl bg-white p-8 text-center border border-slate-200">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-2" />
        <h2 className="text-base font-semibold text-slate-900">Voter Record Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">
          The requested record ID does not exist or you do not have authorization to view it.
        </p>
        <button
          onClick={() => navigate('/voters')}
          className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-500"
        >
          Return to Directory
        </button>
      </div>
    );
  }

  const voter = data;
  const booth = voter.pollingStationId;
  const isDupSerial =
    voter.duplicateFlags?.includes('DUPLICATE_SERIAL_ID') ||
    voter.dataQualityFlags?.includes('DUPLICATE_SERIAL_ID');
  const isDupEpic =
    voter.duplicateFlags?.includes('DUPLICATE_EPIC_NUMBER') ||
    voter.dataQualityFlags?.includes('DUPLICATE_EPIC_NUMBER');

  const handleArchiveToggle = async () => {
    try {
      setIsActionLoading(true);
      if (voter.isArchived) {
        await voterApi.restore(id);
      } else {
        await voterApi.archive(id, archiveReason || 'Administrative Archival');
      }
      setArchiveModalOpen(false);
      refetch();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Operation failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-3">
          <button
            type="button"
            onClick={() => navigate('/voters')}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 mt-0.5 sm:mt-0 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{voter.fullName}</h1>
              {voter.isArchived && <StatusBadge status="Archived" />}
              {isDupSerial && <StatusBadge status="DUPLICATE_SERIAL_ID" />}
              {isDupEpic && <StatusBadge status="DUPLICATE_EPIC_NUMBER" />}
              {!voter.isArchived && !isDupSerial && !isDupEpic && (
                <StatusBadge status="Unique" />
              )}
              <FamilyBadge role={voter.familyRole} familyHead={voter.familyHead} />
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Booth Serial No: <span className="font-bold text-brand-700 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded">#{voter.boothSerialNumber || '—'}</span> • {booth ? <span className="font-semibold text-slate-800">Polling Booth #{booth.officialBoothNumber} • </span> : ''}{voter.epicNumber ? `EPIC: ${voter.epicNumber} • ` : ''}Internal Ref: {id}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCommunicate && !voter.isArchived && voter.mobileNumber && (
            <>
              <button
                type="button"
                onClick={() => setCallModalOpen(true)}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition min-h-[38px] cursor-pointer"
                title="Initiate telephone call to elector"
              >
                <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
                <span>Call Voter</span>
              </button>

              <button
                type="button"
                onClick={() => setWhatsAppModalOpen(true)}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-[#128C7E]/40 bg-[#128C7E]/5 px-3.5 py-2 text-xs font-semibold text-[#128C7E] shadow-sm hover:bg-[#128C7E]/10 transition min-h-[38px] cursor-pointer"
                title="Send official WhatsApp advisory"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setConsentModalOpen(true)}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition min-h-[38px] cursor-pointer"
            title="Manage DPDP communication consent & opt-out"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Consent</span>
          </button>

          {canEditVoter && !voter.isArchived && (
            <NavLink
              to={`/voters/${id}/edit`}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition min-h-[38px]"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit Record</span>
            </NavLink>
          )}

          {canArchiveVoter && (
            <button
              type="button"
              onClick={() => setArchiveModalOpen(true)}
              className={`inline-flex items-center space-x-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-sm transition min-h-[38px] ${
                voter.isArchived
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
            >
              {voter.isArchived ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Restore Record</span>
                </>
              ) : (
                <>
                  <Archive className="h-3.5 w-3.5" />
                  <span>Archive Record</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Archived Notice Banner */}
      {voter.isArchived && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-xs text-amber-900 flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">This record is currently archived</div>
            <p className="mt-0.5 text-amber-800">
              Reason: {voter.archivedReason || 'Administrative retirement'} • Archived on{' '}
              {new Date(voter.archivedAt).toLocaleDateString()}. Under the approved 90-day retention schedule, this
              record is retired from active voter lists but can be restored by an authorized administrator.
            </p>
          </div>
        </div>
      )}

      {/* Duplicate Booth Serial Number Conflict Banner */}
      {isDupSerial && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 text-xs text-amber-950 flex items-start space-x-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="font-bold text-sm text-amber-900 flex items-center justify-between">
              <span>⚠️ Duplicate Booth Serial Number Conflict Flagged</span>
              <NavLink to="/data-quality" className="text-xs font-semibold text-brand-700 hover:underline">
                Open Duplicate Audit Queue →
              </NavLink>
            </div>
            <p className="text-amber-800">
              Booth Serial Number <strong>#{voter.boothSerialNumber}</strong> conflicts with another voter record in Polling Booth #{booth?.officialBoothNumber || '—'}.
              Electoral roll integrity requires each serial ID to uniquely identify one elector per booth.
            </p>
          </div>
        </div>
      )}

      {/* Duplicate EPIC Number Conflict Banner */}
      {isDupEpic && (
        <div className="rounded-xl bg-rose-50 border border-rose-300 p-4 text-xs text-rose-950 flex items-start space-x-3 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="font-bold text-sm text-rose-900 flex items-center justify-between">
              <span>⚠️ Duplicate EPIC Number Conflict Flagged</span>
              <NavLink to="/data-quality" className="text-xs font-semibold text-brand-700 hover:underline">
                Open Duplicate Audit Queue →
              </NavLink>
            </div>
            <p className="text-rose-800">
              EPIC Number <strong>{voter.epicNumber}</strong> is identical to another registered elector in the database.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Photo & Demographic Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Photo & Security Metadata */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 flex flex-col items-center text-center space-y-4">
          <PhotoUploader
            voterId={id}
            photoKey={voter.photoKey}
            canEdit={canEditVoter && !voter.isArchived}
            onPhotoUpdated={() => refetch()}
          />

          <div className="w-full border-t border-slate-100 pt-4 text-left space-y-2.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span className="text-slate-400">Created:</span>
              <span className="font-mono text-slate-700">
                {new Date(voter.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Last Modified:</span>
              <span className="font-mono text-slate-700">
                {new Date(voter.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Security Clearance:</span>
              <span className="text-emerald-700 font-medium flex items-center">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
              </span>
            </div>
          </div>
        </div>

        {/* Right Columns: Personal Details & Polling Station */}
        <div className="md:col-span-2 space-y-6">
          {/* Identity & Personal Info Card */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2 flex items-center">
              <User className="h-3.5 w-3.5 mr-1.5 text-brand-600" />
              Electoral Identification & Personal Details
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Full Name</span>
                <span className="font-semibold text-slate-900 text-sm">{voter.fullName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Relative / Guardian</span>
                <span className="font-semibold text-slate-900 text-sm">
                  {voter.relativeName || '—'} ({voter.relationType})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Booth Serial No. (Primary)</span>
                <span className="font-mono font-bold text-brand-700 text-sm">#{voter.boothSerialNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Polling Booth No.</span>
                <span className="font-mono font-bold text-brand-700 text-sm">{booth ? `Booth #${booth.officialBoothNumber}` : 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Official EPIC No.</span>
                <span className="font-mono font-semibold text-slate-700 text-sm">{voter.epicNumber || 'Not Issued'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Mobile / Phone Number</span>
                {voter.mobileNumber ? (
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {voter.mobileNumber}
                    </span>
                    {canCommunicate && !voter.isArchived && (
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => setCallModalOpen(true)}
                          className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                          title="Place call to voter"
                        >
                          <Phone className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setWhatsAppModalOpen(true)}
                          className="p-1 rounded bg-teal-50 text-[#128C7E] hover:bg-teal-100 border border-teal-200 transition cursor-pointer"
                          title="Send official WhatsApp message"
                        >
                          <MessageSquare className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400 italic text-sm">Not Provided</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Age & Gender</span>
                <span className="font-medium text-slate-800">
                  {voter.age} years • {voter.gender}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Date of Birth</span>
                <span className="font-medium text-slate-800">
                  {voter.dateOfBirth ? new Date(voter.dateOfBirth).toLocaleDateString() : 'Recorded via Age'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Family Notation</span>
                <span className="font-semibold text-slate-900 text-sm flex items-center mt-0.5">
                  <FamilyBadge role={voter.familyRole} familyHead={voter.familyHead} />
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Data Quality Status</span>
                <span className="font-medium text-slate-800">
                  {voter.dataQualityFlags && voter.dataQualityFlags.length > 0 ? (
                    <span className="text-amber-600 font-semibold">{voter.dataQualityFlags.join(', ')}</span>
                  ) : (
                    <span className="text-emerald-600 font-semibold">100% Complete & Verified</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Household & Family Roll Registry Card */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2 flex items-center justify-between">
              <div className="flex items-center">
                <Home className="h-3.5 w-3.5 mr-1.5 text-brand-600" />
                Household & Family Roll Registry
              </div>
              <span className="text-[11px] font-normal text-slate-500">
                {voter.familyRole === 'FH'
                  ? 'Household Head Record'
                  : voter.familyRole === 'FM'
                  ? 'Family Member Record'
                  : 'Independent Elector'}
              </span>
            </h2>

            {voter.familyRole === 'FH' && (
              <div className="space-y-3">
                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 bg-indigo-100 rounded-md text-indigo-700">
                      <Home className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-indigo-900">
                        Designated Family Head (FH)
                      </div>
                      <p className="text-[11px] text-indigo-700 mt-0.5">
                        {voter.familyMembers?.length || 0} family member(s) linked under this household
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-200/60 text-indigo-800 rounded font-mono font-bold text-xs">
                    Head #{voter.boothSerialNumber}
                  </span>
                </div>

                {voter.familyMembers && voter.familyMembers.length > 0 ? (
                  <>
                    {/* Desktop/Tablet Table */}
                    <div className="hidden sm:block overflow-x-auto rounded-lg border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold">
                          <tr>
                            <th className="py-2 px-3 text-left">Booth Sl. #</th>
                            <th className="py-2 px-3 text-left">Full Name</th>
                            <th className="py-2 px-3 text-left">Relation</th>
                            <th className="py-2 px-3 text-left">Age / Gender</th>
                            <th className="py-2 px-3 text-left">EPIC</th>
                            <th className="py-2 px-3 text-right">Profile</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {voter.familyMembers.map((m) => (
                            <tr key={m._id || m.id} className="hover:bg-slate-50/70">
                              <td className="py-2 px-3 font-mono font-bold text-brand-700">
                                #{m.boothSerialNumber}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-900">
                                {m.fullName}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {m.relativeName ? `${m.relativeName} (${m.relationType})` : '—'}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {m.age} yrs • {m.gender}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-500">
                                {m.epicNumber || '—'}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <NavLink
                                  to={`/voters/${m._id || m.id}`}
                                  className="inline-flex items-center text-brand-600 hover:text-brand-700 font-medium"
                                >
                                  <span>View</span>
                                  <ArrowRight className="h-3 w-3 ml-0.5" />
                                </NavLink>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List */}
                    <div className="block sm:hidden divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden bg-white">
                      {voter.familyMembers.map((m) => (
                        <div key={m._id || m.id} className="p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono font-bold text-xs text-brand-700 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded">
                                #{m.boothSerialNumber}
                              </span>
                              <span className="font-semibold text-slate-900 text-xs truncate">{m.fullName}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {m.age} yrs • {m.gender} • {m.relativeName ? `${m.relativeName} (${m.relationType})` : ''}
                            </div>
                            {m.epicNumber && (
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                EPIC: {m.epicNumber}
                              </div>
                            )}
                          </div>
                          <NavLink
                            to={`/voters/${m._id || m.id}`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-brand-600 bg-brand-50/50 hover:bg-brand-50 flex-shrink-0 min-h-[34px]"
                          >
                            <span>View</span>
                            <ArrowRight className="h-3 w-3" />
                          </NavLink>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">
                    No dependent family members have been linked to this Family Head yet.
                  </p>
                )}
              </div>
            )}

            {voter.familyRole === 'FM' && (
              <div className="space-y-3">
                <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 bg-purple-100 rounded-md text-purple-700">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-purple-900">
                          Family Member (FM) — Linked to Family Head
                        </div>
                        {voter.familyHead ? (
                          <div className="text-xs text-purple-800 mt-0.5">
                            Head of Household:{' '}
                            <strong className="text-purple-950 font-semibold">{voter.familyHead.fullName}</strong>{' '}
                            (Booth Sl #{voter.familyHead.boothSerialNumber})
                          </div>
                        ) : (
                          <div className="text-xs text-amber-600 mt-0.5">
                            ⚠️ Unlinked family member (No Family Head record assigned)
                          </div>
                        )}
                      </div>
                    </div>
                    {voter.familyHead && (
                      <NavLink
                        to={`/voters/${voter.familyHead._id || voter.familyHead.id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-md bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500 transition shadow-sm w-fit"
                      >
                        <span>View Family Head Profile</span>
                        <ArrowRight className="h-3 w-3" />
                      </NavLink>
                    )}
                  </div>
                </div>

                {voter.coFamilyMembers && voter.coFamilyMembers.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs font-semibold text-slate-700">
                      Other Household Members ({voter.coFamilyMembers.length}):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {voter.coFamilyMembers.map((cm) => (
                        <NavLink
                          key={cm._id || cm.id}
                          to={`/voters/${cm._id || cm.id}`}
                          className="p-2 rounded-lg border border-slate-200 hover:border-brand-400 hover:bg-brand-50/30 transition flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-brand-700">
                              #{cm.boothSerialNumber}
                            </span>
                            <span className="font-medium text-slate-800">{cm.fullName}</span>
                          </div>
                          <span className="text-[11px] text-slate-500">{cm.relationType}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {voter.familyRole === 'SM' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center space-x-2.5">
                <div className="p-1.5 bg-slate-200 rounded-md text-slate-600">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">SM — Single Member Household</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Registered as an independent individual elector with no dependent members or family head.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Residential Address Card */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2 flex items-center">
              <MapPin className="h-3.5 w-3.5 mr-1.5 text-brand-600" />
              Verified Residential Address
            </h2>

            <div className="space-y-2 text-xs">
              <p className="text-sm font-medium text-slate-800">
                {[
                  voter.address?.houseNumber,
                  voter.address?.street,
                  voter.address?.locality,
                  voter.address?.villageWard,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              <p className="text-slate-600">
                {voter.address?.city}, {voter.address?.district}, {voter.address?.state} —{' '}
                <span className="font-mono font-semibold text-slate-900">{voter.address?.pinCode}</span>
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3 text-slate-500">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                    voter.address?.verified
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {voter.address?.verified ? 'Field Verified Address' : 'Pending Physical Verification'}
                </span>
                {voter.address?.placeId && (
                  <span className="font-mono text-[10px] text-slate-400">
                    Google Place ID: {voter.address.placeId.substring(0, 20)}...
                  </span>
                )}
                {voter.address?.latitude && voter.address?.longitude && (
                  <span className="font-mono text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                    GPS: {Number(voter.address.latitude).toFixed(4)}, {Number(voter.address.longitude).toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Polling Station Booth Association Card */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2 flex items-center">
              <Shield className="h-3.5 w-3.5 mr-1.5 text-brand-600" />
              Officially Assigned Polling Station
            </h2>

            {booth ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm text-slate-900">
                    Booth #{booth.officialBoothNumber} — {booth.stationName}
                  </div>
                  <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-semibold">
                    {booth.assemblyConstituency}
                  </span>
                </div>
                <p className="text-slate-600">{booth.address}</p>
                <div className="text-slate-500 text-[11px] flex items-center justify-between pt-1">
                  <span>Source: {booth.sourceReference || 'ECI Official Gazetted Roll'}</span>
                  <NavLink to="/booths" className="text-brand-600 hover:underline flex items-center">
                    View Booth Registry <ExternalLink className="h-3 w-3 ml-1" />
                  </NavLink>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-amber-50 text-amber-800 text-xs flex items-center justify-between">
                <span>⚠️ No officially verified polling booth has been linked to this record.</span>
                {canEditVoter && (
                  <NavLink to={`/voters/${id}/edit`} className="font-semibold underline">
                    Assign Booth Now
                  </NavLink>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Communication & Outreach History */}
      <CommunicationHistoryTimeline voterId={id} onRefreshNeeded={() => refetch()} />

      {/* Communication Modals */}
      <CallModal
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        voter={voter}
        onCallLogged={() => refetch()}
      />

      <WhatsAppComposerModal
        isOpen={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        voter={voter}
        onMessageSent={() => refetch()}
      />

      <ConsentManagementModal
        isOpen={consentModalOpen}
        onClose={() => setConsentModalOpen(false)}
        voter={voter}
        onConsentUpdated={() => refetch()}
      />

      {/* Confirmation Dialog for Archival */}
      <ConfirmDialog
        isOpen={archiveModalOpen}
        title={voter.isArchived ? 'Restore Record' : 'Archive Voter Record'}
        message={
          voter.isArchived
            ? `Restore "${voter.fullName}" back to the active electoral roll?`
            : `Archive "${voter.fullName}" (${voter.epicNumber})? Please provide an administrative reason.`
        }
        confirmLabel={voter.isArchived ? 'Restore Record' : 'Archive Record'}
        isDestructive={!voter.isArchived}
        isLoading={isActionLoading}
        onConfirm={handleArchiveToggle}
        onCancel={() => setArchiveModalOpen(false)}
      />
    </div>
  );
}

export default VoterDetailsPage;
