import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importExportApi } from '../api/client';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Download,
  ShieldCheck,
  RefreshCw,
  Copy,
} from 'lucide-react';

export function ImportWizardPage() {
  const navigate = useNavigate();

  // Step 1: Upload, Step 2: Preview & Validation, Step 3: Success Summary
  const [step, setStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [dupPage, setDupPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [activeTab, setActiveTab] = useState('valid'); // 'valid' | 'duplicates' | 'errors'
  const [duplicateStrategy, setDuplicateStrategy] = useState('flag'); // 'flag' | 'skip'

  const downloadSampleTemplate = async () => {
    try {
      const res = await importExportApi.downloadTemplate();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ElectionDesk_Sample_Voters_Import.xlsx';
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback in-browser XLSX generation
      try {
        const XLSX = await import('xlsx');
        const sampleData = [
          {
            BOOTH_SERIAL_NO: 1,
            BOOTH_NUMBER: 42,
            FULL_NAME: 'Harpreet Singh Sandhu',
            GENDER: 'Male',
            AGE: 38,
            RELATIVE_NAME: 'Jagjit Singh Sandhu',
            RELATION_TYPE: 'Father',
            FAMILY_ROLE: 'FH',
            FAMILY_HEAD_SERIAL: '',
            MOBILE_NUMBER: '9814012345',
            HOUSE_NO: '142-A',
            STREET: 'Model Town Main Road',
            LOCALITY: 'Model Town',
            WARD: '12',
            DISTRICT: 'Patiala',
            STATE: 'Punjab',
            EPIC_NO: 'PB1049281',
          },
          {
            BOOTH_SERIAL_NO: 2,
            BOOTH_NUMBER: 42,
            FULL_NAME: 'Jasleen Kaur Sandhu',
            GENDER: 'Female',
            AGE: 35,
            RELATIVE_NAME: 'Harpreet Singh Sandhu',
            RELATION_TYPE: 'Husband',
            FAMILY_ROLE: 'FM',
            FAMILY_HEAD_SERIAL: 1,
            MOBILE_NUMBER: '9814012346',
            HOUSE_NO: '142-A',
            STREET: 'Model Town Main Road',
            LOCALITY: 'Model Town',
            WARD: '12',
            DISTRICT: 'Patiala',
            STATE: 'Punjab',
            EPIC_NO: 'PB1049282',
          },
          {
            BOOTH_SERIAL_NO: 1,
            BOOTH_NUMBER: 43,
            FULL_NAME: 'Gurkirat Singh Dhillon',
            GENDER: 'Male',
            AGE: 28,
            RELATIVE_NAME: 'Amrik Singh Dhillon',
            RELATION_TYPE: 'Father',
            FAMILY_ROLE: 'SM',
            FAMILY_HEAD_SERIAL: '',
            MOBILE_NUMBER: '9872012345',
            HOUSE_NO: 'SCO 24',
            STREET: 'Mall Road',
            LOCALITY: 'Leela Bhawan',
            WARD: '12',
            DISTRICT: 'Patiala',
            STATE: 'Punjab',
            EPIC_NO: 'PB2093842',
          },
          {
            BOOTH_SERIAL_NO: 1,
            BOOTH_NUMBER: 44,
            FULL_NAME: 'Simranjit Kaur Mann',
            GENDER: 'Female',
            AGE: 22,
            RELATIVE_NAME: 'Manpreet Singh Mann',
            RELATION_TYPE: 'Father',
            FAMILY_ROLE: 'SM',
            FAMILY_HEAD_SERIAL: '',
            MOBILE_NUMBER: '9876543210',
            HOUSE_NO: 'Plot 512',
            STREET: 'Sector 2 Main Avenue',
            LOCALITY: 'Urban Estate Phase 2',
            WARD: '12',
            DISTRICT: 'Patiala',
            STATE: 'Punjab',
            EPIC_NO: 'PB3910295',
          },
          {
            BOOTH_SERIAL_NO: 1,
            BOOTH_NUMBER: 45,
            FULL_NAME: 'Davinder Singh Sidhu',
            GENDER: 'Male',
            AGE: 50,
            RELATIVE_NAME: 'Gurmukh Singh Sidhu',
            RELATION_TYPE: 'Father',
            FAMILY_ROLE: 'SM',
            FAMILY_HEAD_SERIAL: '',
            MOBILE_NUMBER: '9815012345',
            HOUSE_NO: '78',
            STREET: 'Top Khana Gate Road',
            LOCALITY: 'Top Khana Gate',
            WARD: '12',
            DISTRICT: 'Patiala',
            STATE: 'Punjab',
            EPIC_NO: 'PB4910296',
          },
          {
            BOOTH_SERIAL_NO: 1,
            BOOTH_NUMBER: 46,
            FULL_NAME: 'Manpreet Kaur Cheema',
            GENDER: 'Female',
            AGE: 29,
            RELATIVE_NAME: 'Hardeep Singh Cheema',
            RELATION_TYPE: 'Husband',
            FAMILY_ROLE: 'SM',
            FAMILY_HEAD_SERIAL: '',
            MOBILE_NUMBER: '9815012346',
            HOUSE_NO: '12-B',
            STREET: 'Old Police Lines Road',
            LOCALITY: 'Old Police Lines',
            WARD: '12',
            DISTRICT: 'Patiala',
            STATE: 'Punjab',
            EPIC_NO: 'PB5910297',
          },
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Voter Import Template');
        XLSX.writeFile(wb, 'ElectionDesk_Sample_Voters_Import.xlsx');
      } catch (clientErr) {
        setError('Failed to download Excel template: ' + (clientErr.message || err.message));
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isAllowed =
      lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv');

    if (!isAllowed) {
      setError('Please select a valid Excel spreadsheet (.xlsx, .xls) or CSV file.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('File size exceeds the 15MB limit.');
      return;
    }

    setError('');
    setSelectedFile(file);
  };

  const handleUploadAndPreview = async () => {
    if (!selectedFile) return;

    try {
      setIsProcessing(true);
      setError('');

      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await importExportApi.previewImport(formData);
      setPreviewData(res.data.data);
      setPreviewPage(1);
      setDupPage(1);
      setActiveTab('valid');
      setDuplicateStrategy('flag');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Spreadsheet schema validation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!previewData?.validRows || previewData.validRows.length === 0) return;

    try {
      setIsProcessing(true);
      setError('');

      const skipDuplicates = duplicateStrategy === 'skip';
      const rowsToCommit = previewData.validRows;

      const res = await importExportApi.commitImport(rowsToCommit, { skipDuplicates });
      setImportSummary(res.data.data);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Import commit failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const cleanCount = previewData?.cleanCount ?? ((previewData?.validCount || 0) - (previewData?.duplicateCount || 0));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Authorized Dataset Import Wizard (Excel / XLSX)</h1>
        <p className="text-xs text-slate-500">
          Upload and commit authorized voter rolls via Excel spreadsheet (.xlsx) with schema validation, duplicate detection, and staged processing.
        </p>
      </div>

      {/* Stepper Wizard Bar */}
      <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between text-xs font-semibold">
          <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-brand-600' : 'text-slate-400'}`}>
            <span
              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                step >= 1 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              1
            </span>
            <span>Upload Spreadsheet (.xlsx)</span>
          </div>
          <div className="h-0.5 flex-1 mx-4 bg-slate-200" />
          <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-brand-600' : 'text-slate-400'}`}>
            <span
              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                step >= 2 ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              2
            </span>
            <span>Schema & Duplicate Review</span>
          </div>
          <div className="h-0.5 flex-1 mx-4 bg-slate-200" />
          <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span
              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                step >= 3 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              3
            </span>
            <span>Commit Summary</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 flex items-start space-x-2">
          <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Validation Error</div>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* STEP 1: Upload File */}
      {step === 1 && (
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Select Authorized Excel Spreadsheet</h2>
              <p className="text-xs text-slate-500">Spreadsheet will be validated and duplicate-checked prior to writing.</p>
            </div>
            <button
              type="button"
              onClick={downloadSampleTemplate}
              className="inline-flex items-center space-x-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg border border-brand-200"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Official Excel Template (.xlsx)</span>
            </button>
          </div>

          {/* Drag & Drop File Zone */}
          <div className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-brand-500 transition-colors bg-slate-50/50">
            <FileSpreadsheet className="h-10 w-10 text-brand-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-800">
              {selectedFile ? selectedFile.name : 'Choose an Excel file (.xlsx, .xls) or drag and drop'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports Excel (.xlsx, .xls) and CSV datasets up to 15MB (up to 1,500–2,000 rows per batch).
            </p>

            <label className="mt-4 inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm border border-slate-300 hover:bg-slate-50 cursor-pointer">
              <span>Browse Computer</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              disabled={!selectedFile || isProcessing}
              onClick={handleUploadAndPreview}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-brand-500 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Parsing & Checking Duplicates...</span>
                </>
              ) : (
                <>
                  <span>Next: Preview & Validate</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Schema & Duplicate Review Preview */}
      {step === 2 && previewData && (
        <div className="space-y-6">
          {/* Summary Badges (Clickable to switch view) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white p-4 border border-slate-200 text-center">
              <span className="text-xs text-slate-400 font-medium">Total Rows</span>
              <div className="text-xl font-bold text-slate-900 mt-1">{previewData.totalRows}</div>
            </div>

            <div
              onClick={() => setActiveTab('valid')}
              className={`rounded-xl p-4 border text-center cursor-pointer transition-all ${
                activeTab === 'valid'
                  ? 'bg-emerald-100 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/30'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70'
              }`}
            >
              <span className="text-xs font-medium">Valid Ready to Commit</span>
              <div className="text-xl font-bold mt-1">{previewData.validCount}</div>
            </div>

            <div
              onClick={() => setActiveTab('duplicates')}
              className={`rounded-xl p-4 border text-center cursor-pointer transition-all ${
                activeTab === 'duplicates'
                  ? 'bg-amber-100 border-amber-400 text-amber-900 ring-2 ring-amber-500/30'
                  : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/70'
              }`}
            >
              <div className="flex items-center justify-center space-x-1">
                <span className="text-xs font-medium">Flagged Duplicates</span>
                {previewData.duplicateCount > 0 && (
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </div>
              <div className="text-xl font-bold mt-1">{previewData.duplicateCount}</div>
            </div>

            <div
              onClick={() => setActiveTab('errors')}
              className={`rounded-xl p-4 border text-center cursor-pointer transition-all ${
                activeTab === 'errors'
                  ? 'bg-rose-100 border-rose-400 text-rose-900 ring-2 ring-rose-500/30'
                  : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100/70'
              }`}
            >
              <span className="text-xs font-medium">Validation Errors</span>
              <div className="text-xl font-bold mt-1">{previewData.errorCount}</div>
            </div>
          </div>

          {/* Duplicate Records Import Strategy Selector */}
          {previewData.duplicateCount > 0 && (
            <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    {previewData.duplicateCount} Duplicate Record{previewData.duplicateCount > 1 ? 's' : ''} Detected
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('duplicates')}
                  className="text-xs text-amber-700 hover:text-amber-800 font-semibold underline"
                >
                  {activeTab === 'duplicates' ? 'Currently viewing duplicates' : 'Review duplicate records ↓'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <label
                  className={`flex items-start space-x-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                    duplicateStrategy === 'flag'
                      ? 'bg-white border-amber-400 shadow-sm ring-1 ring-amber-400'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicateStrategy"
                    value="flag"
                    checked={duplicateStrategy === 'flag'}
                    onChange={() => setDuplicateStrategy('flag')}
                    className="mt-0.5 text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <div className="font-semibold text-slate-800">
                      Import all and flag duplicates (Recommended)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Saves records with DUPLICATE_SERIAL_ID or DUPLICATE_EPIC_NUMBER flags and routes them to the Data Quality queue for administrative verification.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start space-x-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                    duplicateStrategy === 'skip'
                      ? 'bg-white border-brand-500 shadow-sm ring-1 ring-brand-500'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicateStrategy"
                    value="skip"
                    checked={duplicateStrategy === 'skip'}
                    onChange={() => setDuplicateStrategy('skip')}
                    className="mt-0.5 text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <div className="font-semibold text-slate-800">
                      Skip duplicates (Clean records only)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Only commits unique clean records ({cleanCount} rows). Omits all {previewData.duplicateCount} duplicate records from the database.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 space-x-4 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('valid')}
              className={`pb-2.5 px-1 border-b-2 font-semibold transition-colors ${
                activeTab === 'valid'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Validated Records ({previewData.validCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('duplicates')}
              className={`pb-2.5 px-1 border-b-2 font-semibold transition-colors flex items-center space-x-1.5 ${
                activeTab === 'duplicates'
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <span>Duplicate Records</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  previewData.duplicateCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {previewData.duplicateCount}
              </span>
            </button>
            {previewData.errorCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('errors')}
                className={`pb-2.5 px-1 border-b-2 font-semibold transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'errors'
                    ? 'border-rose-500 text-rose-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <span>Validation Errors</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                  {previewData.errorCount}
                </span>
              </button>
            )}
          </div>

          {/* TAB 1: Valid Rows Preview Table */}
          {activeTab === 'valid' && (
            <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center">
                  <CheckCircle className="h-4 w-4 text-emerald-600 mr-1.5 flex-shrink-0" />
                  <span>
                    Validated Records ({previewData.validCount.toLocaleString()} ready to commit
                    {duplicateStrategy === 'skip' && previewData.duplicateCount > 0
                      ? ` • ${cleanCount} unique clean`
                      : ''}
                    )
                  </span>
                </h3>
                <div className="flex items-center space-x-2 text-xs text-slate-500">
                  <span>Display:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPreviewPage(1);
                    }}
                    className="rounded-lg border border-slate-300 py-1 px-2.5 text-xs bg-white text-slate-700 focus:border-brand-600 focus:outline-none"
                  >
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                    <option value={250}>250 per page</option>
                    <option value={500}>500 per page</option>
                    <option value={2500}>Show All</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Booth Sl. #</th>
                      <th className="py-2.5 px-3 text-left">Full Name</th>
                      <th className="py-2.5 px-3 text-left">Age / Gender</th>
                      <th className="py-2.5 px-3 text-left">Family Role</th>
                      <th className="py-2.5 px-3 text-left">EPIC Ref</th>
                      <th className="py-2.5 px-3 text-left">Relative / Mobile</th>
                      <th className="py-2.5 px-3 text-left">Locality</th>
                      <th className="py-2.5 px-3 text-left">Duplicate Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {previewData.validRows
                      .slice((previewPage - 1) * pageSize, previewPage * pageSize)
                      .map((v, i) => (
                        <tr
                          key={i}
                          className={v.isDuplicate ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'hover:bg-slate-50/50'}
                        >
                          <td className="py-2 px-3 font-mono font-bold text-brand-700">
                            #{v.boothSerialNumber || (previewPage - 1) * pageSize + i + 1}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-900">{v.fullName}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {v.age} • <span className="text-slate-500">{v.gender}</span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="font-semibold text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                              {v.familyRole || 'SM'}
                            </span>
                            {v.familyHeadSerial && (
                              <span className="text-[10px] text-purple-700 block font-medium mt-0.5">
                                Head #{v.familyHeadSerial}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-500">{v.epicNumber || '—'}</td>
                          <td className="py-2 px-3">
                            <div className="font-medium text-slate-800">{v.relativeName || '—'}</div>
                            {v.mobileNumber && <div className="text-[10px] text-slate-500">{v.mobileNumber}</div>}
                          </td>
                          <td className="py-2 px-3">
                            {v.address?.locality || v.address?.villageWard || v.address?.street || '—'}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {v.isDuplicate ? (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                <span>{v.duplicateFlags?.[0] || 'DUPLICATE'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                                <span>Unique</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {previewData.validRows.length > pageSize && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <span>
                    Showing {((previewPage - 1) * pageSize) + 1}–{Math.min(previewPage * pageSize, previewData.validRows.length)} of {previewData.validRows.length.toLocaleString()} valid rows
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={previewPage <= 1}
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="font-medium text-slate-700">
                      Page {previewPage} of {Math.ceil(previewData.validRows.length / pageSize)}
                    </span>
                    <button
                      type="button"
                      disabled={previewPage >= Math.ceil(previewData.validRows.length / pageSize)}
                      onClick={() => setPreviewPage((p) => Math.min(Math.ceil(previewData.validRows.length / pageSize), p + 1))}
                      className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Duplicate Records Review Table */}
          {activeTab === 'duplicates' && (
            <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mr-1.5 flex-shrink-0" />
                  <span>Flagged Duplicate Records ({previewData.duplicateRows.length})</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Detected within this file or conflicting with database
                </span>
              </div>

              {previewData.duplicateRows.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <div className="font-semibold text-slate-800">No Duplicate Records Found</div>
                  <p className="mt-1 text-slate-500">All rows in this spreadsheet are unique across booth serials and EPIC numbers.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                        <tr>
                          <th className="py-2.5 px-3 text-left">Row #</th>
                          <th className="py-2.5 px-3 text-left">Booth & Serial</th>
                          <th className="py-2.5 px-3 text-left">Full Name</th>
                          <th className="py-2.5 px-3 text-left">EPIC Ref</th>
                          <th className="py-2.5 px-3 text-left">Duplicate Type</th>
                          <th className="py-2.5 px-3 text-left">Conflict Detail / Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {previewData.duplicateRows
                          .slice((dupPage - 1) * pageSize, dupPage * pageSize)
                          .map((d, i) => (
                            <tr key={i} className="hover:bg-amber-50/40">
                              <td className="py-2 px-3 font-mono text-slate-500">Row #{d.row}</td>
                              <td className="py-2 px-3 font-mono font-bold text-amber-800">
                                Booth #{d.boothNumber || '—'} • Serial #{d.boothSerialNumber}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-900">
                                <div>{d.name}</div>
                                {d.relativeName && (
                                  <div className="text-[10px] text-slate-400">R: {d.relativeName}</div>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono font-medium text-slate-700">{d.epic || '—'}</td>
                              <td className="py-2 px-3 whitespace-nowrap">
                                {(d.duplicateFlags || [d.duplicateType]).map((flag, fi) => (
                                  <span
                                    key={fi}
                                    className="inline-block text-[10px] font-bold px-2 py-0.5 rounded mr-1 bg-amber-100 text-amber-800 border border-amber-300"
                                  >
                                    {flag.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </td>
                              <td className="py-2 px-3 text-slate-600 max-w-xs">
                                <div className="font-medium text-amber-900">{d.reason}</div>
                                {d.conflictWith && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    Conflict: {d.conflictWith}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {previewData.duplicateRows.length > pageSize && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <span>
                        Showing {((dupPage - 1) * pageSize) + 1}–{Math.min(dupPage * pageSize, previewData.duplicateRows.length)} of {previewData.duplicateRows.length} duplicate rows
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          disabled={dupPage <= 1}
                          onClick={() => setDupPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <span className="font-medium text-slate-700">
                          Page {dupPage} of {Math.ceil(previewData.duplicateRows.length / pageSize)}
                        </span>
                        <button
                          type="button"
                          disabled={dupPage >= Math.ceil(previewData.duplicateRows.length / pageSize)}
                          onClick={() => setDupPage((p) => Math.min(Math.ceil(previewData.duplicateRows.length / pageSize), p + 1))}
                          className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 3: Validation Errors Notice */}
          {activeTab === 'errors' && previewData.errorCount > 0 && (
            <div className="rounded-xl bg-white p-5 border border-rose-200 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-rose-700 flex items-center">
                <XCircle className="h-4 w-4 mr-1.5" />
                Rows with Validation Errors (Will Be Skipped)
              </h3>
              <div className="max-h-64 overflow-y-auto space-y-2 text-xs">
                {previewData.errors.map((err, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-rose-50 border border-rose-100 flex justify-between">
                    <span>
                      Row #{err.row} ({err.epic} - {err.name}):
                    </span>
                    <span className="text-rose-600 font-medium">{err.errors.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Confirmation Bar */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-semibold text-slate-600 hover:underline text-center sm:text-left py-2"
            >
              ← Choose another file
            </button>

            <button
              type="button"
              disabled={isProcessing || previewData.validCount === 0}
              onClick={handleCommitImport}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50 min-h-[40px]"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Writing Records to Persistent Database...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>
                    {duplicateStrategy === 'skip' && previewData.duplicateCount > 0
                      ? `Confirm & Commit ${cleanCount.toLocaleString()} Clean Records (Skipping ${previewData.duplicateCount} Duplicates)`
                      : previewData.duplicateCount > 0
                      ? `Confirm & Commit All ${previewData.validCount.toLocaleString()} Records (${previewData.duplicateCount} Flagged as Duplicates)`
                      : `Confirm & Commit All ${previewData.validCount.toLocaleString()} Records`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Success Summary */}
      {step === 3 && importSummary && (
        <div className="rounded-xl bg-white p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Import Job Successfully Completed</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Successfully committed <strong>{importSummary.importedCount}</strong> voter records to the master database.
            A cryptographic audit log entry has been permanently recorded.
          </p>

          {importSummary.flaggedDuplicateCount > 0 && (
            <div className="max-w-md mx-auto rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 text-left flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">
                  {importSummary.flaggedDuplicateCount} duplicate record{importSummary.flaggedDuplicateCount > 1 ? 's were' : ' was'} flagged for review.
                </span>
                <p className="mt-0.5 text-amber-700">
                  These records have been marked with duplicate serial or EPIC flags and routed to Data Quality for verification.
                </p>
              </div>
            </div>
          )}

          {importSummary.skippedDuplicateCount > 0 && (
            <div className="max-w-md mx-auto rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 text-left">
              <strong>{importSummary.skippedDuplicateCount} duplicate record{importSummary.skippedDuplicateCount > 1 ? 's' : ''}</strong> were skipped according to your import settings.
            </div>
          )}

          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-2.5 sm:space-x-3">
            <button
              type="button"
              onClick={() => navigate('/voters')}
              className="w-full sm:w-auto rounded-lg bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-brand-500 min-h-[40px]"
            >
              View Voter Directory
            </button>
            {importSummary.flaggedDuplicateCount > 0 && (
              <button
                type="button"
                onClick={() => navigate('/data-quality')}
                className="w-full sm:w-auto rounded-lg bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-amber-500 min-h-[40px]"
              >
                Review in Data Quality
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setSelectedFile(null);
                setPreviewData(null);
                setImportSummary(null);
                setActiveTab('valid');
              }}
              className="w-full sm:w-auto rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[40px]"
            >
              Import Another Dataset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportWizardPage;
