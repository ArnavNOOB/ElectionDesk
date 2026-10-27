import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../api/client';
import Pagination from '../components/Pagination';
import {
  FileText,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Hash,
  RefreshCw,
} from 'lucide-react';

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedOutcome, setSelectedOutcome] = useState('');
  const [actorEmailSearch, setActorEmailSearch] = useState('');

  // Fetch audit logs
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-logs', page, selectedAction, selectedEntity, selectedOutcome, actorEmailSearch],
    queryFn: async () => {
      const res = await auditApi.list({
        page,
        limit: 25,
        action: selectedAction || undefined,
        entityType: selectedEntity || undefined,
        outcome: selectedOutcome || undefined,
        actorEmail: actorEmailSearch || undefined,
      });
      return res.data;
    },
  });

  // Verify chain integrity
  const { data: integrityData, isLoading: isCheckingIntegrity, refetch: verifyChain } = useQuery({
    queryKey: ['audit-chain-integrity'],
    queryFn: async () => {
      const res = await auditApi.verifyChain();
      return res.data.data;
    },
  });

  const logs = data?.data || [];
  const pagination = data?.meta || { page: 1, limit: 25, total: 0, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cryptographic Security Audit Trail</h1>
          <p className="text-xs text-slate-500">
            Immutable, SHA-256 hash-chained log of all authentication, administrative CRUD, and export operations.
          </p>
        </div>

        {/* Chain Integrity Badge */}
        <div className="flex items-center space-x-2">
          {integrityData?.valid ? (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold shadow-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>SHA-256 Hash Chain: Verified (Tamper-Free)</span>
            </div>
          ) : (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold shadow-sm">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              <span>Hash Chain Discontinuity Detected!</span>
            </div>
          )}
          <button
            onClick={() => verifyChain()}
            disabled={isCheckingIntegrity}
            title="Re-verify cryptographic chain"
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${isCheckingIntegrity ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Actor Email</label>
          <input
            type="text"
            value={actorEmailSearch}
            onChange={(e) => {
              setActorEmailSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search email..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs text-slate-900 focus:border-brand-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Action Type</label>
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs text-slate-700 focus:border-brand-600 focus:outline-none"
          >
            <option value="">All Actions</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="MFA_VERIFY">MFA_VERIFY</option>
            <option value="RECORD_CREATE">RECORD_CREATE</option>
            <option value="RECORD_UPDATE">RECORD_UPDATE</option>
            <option value="RECORD_ARCHIVE">RECORD_ARCHIVE</option>
            <option value="RECORD_RESTORE">RECORD_RESTORE</option>
            <option value="PHOTO_UPLOAD">PHOTO_UPLOAD</option>
            <option value="PHOTO_VIEW">PHOTO_VIEW</option>
            <option value="DATA_EXPORT">DATA_EXPORT</option>
            <option value="BULK_IMPORT">BULK_IMPORT</option>
            <option value="ROLE_CHANGE">ROLE_CHANGE</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Entity Type</label>
          <select
            value={selectedEntity}
            onChange={(e) => {
              setSelectedEntity(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs text-slate-700 focus:border-brand-600 focus:outline-none"
          >
            <option value="">All Entities</option>
            <option value="VOTER">VOTER</option>
            <option value="POLLING_STATION">POLLING_STATION</option>
            <option value="USER">USER</option>
            <option value="PHOTO">PHOTO</option>
            <option value="IMPORT_JOB">IMPORT_JOB</option>
            <option value="EXPORT_JOB">EXPORT_JOB</option>
            <option value="SECURITY">SECURITY</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Outcome</label>
          <select
            value={selectedOutcome}
            onChange={(e) => {
              setSelectedOutcome(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs text-slate-700 focus:border-brand-600 focus:outline-none"
          >
            <option value="">All Outcomes</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
            <option value="DENIED">DENIED</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent mx-auto mb-2" />
            Loading cryptographic audit records...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="font-medium text-slate-700">No audit events match your filter parameters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3 text-left">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3 text-left">Actor (Email & Role)</th>
                  <th className="py-2.5 px-3 text-left">Action</th>
                  <th className="py-2.5 px-3 text-left">Target Entity</th>
                  <th className="py-2.5 px-3 text-left">Outcome</th>
                  <th className="py-2.5 px-3 text-left">IP Address</th>
                  <th className="py-2.5 px-3 text-left">Details / Diff</th>
                  <th className="py-2.5 px-3 text-right">Cryptographic Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-sans">
                {logs.map((log) => {
                  const id = log._id || log.id;
                  return (
                    <tr key={id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{log.actorEmail}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">{log.actorRole}</div>
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="font-mono font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                          {log.action}
                        </span>
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap text-slate-600">
                        <span className="font-medium text-slate-800">{log.entityType}</span>
                        {log.entityId && (
                          <span className="block text-[10px] font-mono text-slate-400">ID: {log.entityId}</span>
                        )}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                            log.outcome === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {log.outcome}
                        </span>
                      </td>

                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {log.ipAddress}
                      </td>

                      <td className="py-2 px-3 text-[11px] text-slate-600 max-w-xs truncate" title={JSON.stringify(log.details)}>
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>

                      <td className="py-2 px-3 text-right font-mono text-[10px] text-slate-400 whitespace-nowrap" title={`Record Hash: ${log.recordHash}\nPrevious: ${log.previousHash}`}>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {log.recordHash ? `${log.recordHash.substring(0, 10)}...` : 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination pagination={pagination} onPageChange={(p) => setPage(p)} />
      </div>
    </div>
  );
}

export default AuditLogsPage;
