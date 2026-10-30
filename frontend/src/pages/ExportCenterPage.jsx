import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { boothApi, importExportApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Download,
  ShieldCheck,
  ShieldAlert,
  FileSpreadsheet,
  AlertTriangle,
  Lock,
  CheckCircle,
} from 'lucide-react';

export function ExportCenterPage() {
  const { requestStepUp, canExport, user } = useAuth();

  const [selectedBooth, setSelectedBooth] = useState('');
  const [selectedDuplicateFilter, setSelectedDuplicateFilter] = useState('');
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [error, setError] = useState('');

  // Fetch booths
  const { data: booths } = useQuery({
    queryKey: ['booths-list'],
    queryFn: async () => {
      const res = await boothApi.list();
      return res.data.data || [];
    },
  });

  const handleExport = async () => {
    try {
      setError('');
      setExportSuccess(false);

      // 1. Trigger Step-Up Re-Authentication Prompt
      const stepUpToken = await requestStepUp();
      if (!stepUpToken) return;

      setIsExporting(true);

      // 2. Perform authenticated export
      const params = { format: exportFormat };
      if (selectedBooth) params.pollingStationId = selectedBooth;
      if (selectedDuplicateFilter) params.duplicateFilter = selectedDuplicateFilter;

      const res = await importExportApi.exportVoters(params, stepUpToken);

      // 3. Trigger browser file download
      const mimeType =
        exportFormat === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv;charset=utf-8;';
      const fileExt = exportFormat === 'xlsx' ? 'xlsx' : 'csv';

      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ElectionDesk_Voters_Export_${new Date().toISOString().substring(0, 10)}.${fileExt}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportSuccess(true);
    } catch (err) {
      if (err.message?.includes('cancelled')) return;
      setError(err.response?.data?.error?.message || err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  if (!canExport) {
    return (
      <div className="rounded-xl bg-white p-8 border border-slate-200 text-center">
        <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto mb-2" />
        <h2 className="text-base font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-xs text-slate-500 mt-1">
          Your current account role does not possess permissions to generate bulk voter exports.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Electoral Roll Export Center</h1>
        <p className="text-xs text-slate-500">
          Generate filtered administrative data exports. Step-up authentication and CSV formula injection sanitization are enforced.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 flex items-start space-x-2">
          <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {exportSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 flex items-start space-x-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Export Successfully Generated</div>
            <p className="mt-0.5">
              The sanitized CSV file has been securely downloaded. An immutable audit log entry was created for accountability.
            </p>
          </div>
        </div>
      )}

      {/* Export Options Form */}
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-5">
        <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
          <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Configure Export Filters</h2>
            <p className="text-xs text-slate-500">Download only authorized records matching approved operational needs.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Filter by Polling Booth</label>
            <select
              value={selectedBooth}
              onChange={(e) => setSelectedBooth(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs text-slate-700 focus:border-brand-600 focus:outline-none"
            >
              <option value="">All Polling Stations (Entire Constituency)</option>
              {booths?.map((b) => (
                <option key={b._id || b.id} value={b._id || b.id}>
                  Booth #{b.officialBoothNumber} — {b.stationName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Filter by Duplicate Status</label>
            <select
              value={selectedDuplicateFilter}
              onChange={(e) => setSelectedDuplicateFilter(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs text-slate-700 focus:border-brand-600 focus:outline-none"
            >
              <option value="">All Records</option>
              <option value="CLEAN">Clean / Unique Records Only</option>
              <option value="ALL_DUPLICATES">Flagged Duplicates Only</option>
              <option value="DUPLICATE_SERIAL_ID">Duplicate Serial ID Only</option>
              <option value="DUPLICATE_EPIC_NUMBER">Duplicate EPIC Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Export File Format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-xs text-slate-700 focus:border-brand-600 focus:outline-none font-medium"
            >
              <option value="xlsx">Excel Spreadsheet (.xlsx)</option>
              <option value="csv">Standard CSV (.csv)</option>
            </select>
          </div>
        </div>

        {/* Security Disclaimers */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs text-slate-600">
          <div className="font-semibold text-slate-800 flex items-center">
            <ShieldCheck className="h-4 w-4 text-emerald-600 mr-1.5" />
            Statutory Protections Enforced During Export:
          </div>
          <ul className="list-disc pl-5 space-y-1 text-slate-500 text-[11px]">
            <li>
              <strong>CSV Formula Injection Shield (CWE-1236):</strong> All spreadsheet cells beginning with{' '}
              <code className="text-slate-800 font-mono">=</code>, <code className="text-slate-800 font-mono">+</code>,{' '}
              <code className="text-slate-800 font-mono">-</code>, or <code className="text-slate-800 font-mono">@</code> are automatically escaped with single quotes.
            </li>
            <li>
              <strong>Step-Up Authentication Required:</strong> You will be prompted to re-enter your password before the dataset is generated.
            </li>
            <li>
              <strong>Tamper-Resistant Audit Logging:</strong> Your user identity, IP address, and applied filter criteria are permanently logged.
            </li>
            <li>
              <strong>Maximum Record Limit:</strong> Exports are capped at 5,000 records per job.
            </li>
          </ul>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-lg bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:opacity-50 transition min-h-[40px]"
          >
            {isExporting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Generating Export...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Authorize & Download {exportFormat.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportCenterPage;
