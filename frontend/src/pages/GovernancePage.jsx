import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { governanceApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Settings,
  ShieldCheck,
  FileText,
  Clock,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Save,
  Lock,
} from 'lucide-react';

export function GovernancePage() {
  const { requestStepUp, isSuperAdmin } = useAuth();

  const [policyState, setPolicyState] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['governance-policy'],
    queryFn: async () => {
      const res = await governanceApi.getPolicy();
      setPolicyState(res.data.data);
      return res.data.data;
    },
  });

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      const stepUpToken = await requestStepUp();
      if (!stepUpToken) return;

      await governanceApi.updatePolicy(policyState, stepUpToken);
      setSuccess('Data retention and governance policy updated successfully');
      refetch();
    } catch (err) {
      if (err.message?.includes('cancelled')) return;
      setError(err.response?.data?.error?.message || 'Failed to update governance policy');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunPurge = async () => {
    if (
      !window.confirm(
        'Execute automated retention purge? This will permanently delete archived records older than the configured threshold.'
      )
    )
      return;

    try {
      setError('');
      setPurgeResult(null);

      const stepUpToken = await requestStepUp();
      if (!stepUpToken) return;

      const res = await governanceApi.runPurge(stepUpToken);
      setPurgeResult(res.data.data);
      refetch();
    } catch (err) {
      if (err.message?.includes('cancelled')) return;
      setError(err.response?.data?.error?.message || 'Purge execution failed');
    }
  };

  if (isLoading || !policyState) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading statutory data governance policies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Privacy, Retention & Data Governance (DPDP Act, 2023)
        </h1>
        <p className="text-xs text-slate-500">
          Statutory compliance controls, retention schedules, lawful basis declarations, and data erasure workflows.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 flex items-start space-x-2">
          <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 flex items-start space-x-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {purgeResult && (
        <div className="rounded-lg bg-slate-800 text-white p-4 text-xs flex items-center justify-between">
          <span>
            Retention Purge Finished: <strong>{purgeResult.purgedCount}</strong> archived records permanently purged.
          </span>
          <span className="font-mono text-emerald-400">Cryptographically Audit-Logged</span>
        </div>
      )}

      {/* Statutory Mandate Overview Card */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center space-x-2 text-brand-700 font-semibold text-sm border-b border-slate-100 pb-3">
          <ShieldCheck className="h-5 w-5" />
          <span>Digital Personal Data Protection (DPDP) Act, 2023 Compliance Baseline</span>
        </div>

        <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
          <p>
            The ElectionDesk platform collects and retains voter records strictly pursuant to official election laws and
            the Digital Personal Data Protection Act, 2023. Personally identifiable data is collected solely for the
            preparation, revision, and administration of electoral rolls.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">Lawful Basis for Processing:</span>
              <p className="text-slate-600">{policyState.lawfulBasis}</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-900 block mb-1">Data Protection Officer (DPO):</span>
              <p className="text-slate-600">
                {policyState.dataProtectionOfficer?.name} ({policyState.dataProtectionOfficer?.email})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Retention Schedule Form */}
      <form onSubmit={handleSavePolicy} className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">Approved Retention & Erasure Schedule</h2>
          </div>
          <span className="text-xs font-mono text-slate-400">Policy Version: {policyState.dpdpNoticeVersion}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Active Roll Retention Period (Days)</label>
            <input
              type="number"
              disabled={!isSuperAdmin}
              value={policyState.retentionDays}
              onChange={(e) => setPolicyState({ ...policyState, retentionDays: parseInt(e.target.value, 10) })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none disabled:bg-slate-100"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Default: 1,825 days (5 years standard electoral cycle)</span>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Archived Records Purge Threshold (Days)</label>
            <input
              type="number"
              disabled={!isSuperAdmin}
              value={policyState.archivedPurgeDays}
              onChange={(e) => setPolicyState({ ...policyState, archivedPurgeDays: parseInt(e.target.value, 10) })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none disabled:bg-slate-100"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Archived records older than this will be permanently purged</span>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="pt-2 flex justify-between items-center border-t border-slate-100">
            <button
              type="button"
              onClick={handleRunPurge}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Execute Automated Retention Purge</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 shadow-sm"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? 'Authorizing...' : 'Save Policy Changes'}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

export default GovernancePage;
