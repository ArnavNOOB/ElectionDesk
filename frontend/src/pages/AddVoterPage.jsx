import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { voterApi, boothApi } from '../api/client';
import AddressAutocomplete from '../components/AddressAutocomplete';
import PhotoUploader from '../components/PhotoUploader';
import { UserPlus, ArrowLeft, Save, AlertTriangle, ShieldCheck } from 'lucide-react';

export function AddVoterPage() {
  const navigate = useNavigate();

  // Form State
  const [boothSerialNumber, setBoothSerialNumber] = useState('');
  const [epicNumber, setEpicNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [relativeName, setRelativeName] = useState('');
  const [relationType, setRelationType] = useState('Father');
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState(25);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [pollingStationId, setPollingStationId] = useState('');
  const [familyRole, setFamilyRole] = useState('SM');
  const [familyHeadId, setFamilyHeadId] = useState('');

  const [address, setAddress] = useState({
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
  });

  const [errors, setErrors] = useState({});
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch verified polling booths
  const { data: booths } = useQuery({
    queryKey: ['booths-list'],
    queryFn: async () => {
      const res = await boothApi.list();
      return res.data.data || [];
    },
  });

  // Fetch family heads (filtered by selected booth if selected)
  const { data: familyHeads } = useQuery({
    queryKey: ['family-heads', pollingStationId],
    queryFn: async () => {
      const res = await voterApi.getFamilyHeads({
        pollingStationId: pollingStationId || undefined,
      });
      return res.data.data || [];
    },
  });

  // Client validation
  const validateForm = () => {
    const errs = {};
    const serial = parseInt(boothSerialNumber, 10);
    if (!boothSerialNumber || isNaN(serial) || serial <= 0) {
      errs.boothSerialNumber = 'Booth Serial Number is required (positive integer, e.g. 1, 2, 3...)';
    }
    if (!fullName.trim() || fullName.length < 2) {
      errs.fullName = 'Full Name is required (minimum 2 characters)';
    }
    if (!relativeName.trim()) {
      errs.relativeName = 'Relative Name is required';
    }
    if (!age || age < 18 || age > 120) {
      errs.age = 'Voter age must be between 18 and 120 years';
    }
    if (!address.city.trim()) {
      errs['address.city'] = 'City is required';
    }
    if (!address.pinCode || !/^[1-9][0-9]{5}$/.test(address.pinCode.trim())) {
      errs['address.pinCode'] = 'Valid 6-digit Indian PIN code is required';
    }
    if (familyRole === 'FM' && !familyHeadId) {
      errs.familyHeadId = 'Please select a Family Head (FH) for this Family Member';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Check potential duplicates on blur of Serial, EPIC, or Names
  const handleCheckDuplicates = async () => {
    if (!boothSerialNumber && !epicNumber && (!fullName || !relativeName)) return;
    try {
      const res = await voterApi.checkDuplicates({
        boothSerialNumber: parseInt(boothSerialNumber, 10) || null,
        pollingStationId: pollingStationId || null,
        epicNumber: (epicNumber || '').trim(),
        fullName: (fullName || '').trim(),
        relativeName: (relativeName || '').trim(),
        age: parseInt(age, 10) || 25,
        address,
      });
      const matches = res.data.data || [];
      if (matches.length > 0) {
        setDuplicateWarning(matches[0]);
      } else {
        setDuplicateWarning(null);
      }
    } catch (err) {
      // Ignore
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const payload = {
        boothSerialNumber: parseInt(boothSerialNumber, 10),
        epicNumber: epicNumber ? epicNumber.trim().toUpperCase() : '',
        mobileNumber: mobileNumber.trim(),
        fullName: fullName.trim(),
        relativeName: relativeName.trim(),
        relationType,
        familyRole,
        familyHeadId: familyRole === 'FM' ? familyHeadId : null,
        gender,
        age: parseInt(age, 10),
        dateOfBirth: dateOfBirth || null,
        address,
        pollingStationId: pollingStationId || null,
      };

      const res = await voterApi.create(payload);
      const createdId = res.data.data?._id || res.data.data?.id;
      navigate(`/voters/${createdId}`);
    } catch (err) {
      const serverMessage = err.response?.data?.error?.message || err.message || 'Creation failed';
      setErrors({ form: serverMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => navigate('/voters')}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Add Authorized Voter Record</h1>
            <p className="text-xs text-slate-500">
              Enter official elector details. Every field adheres to strict statutory validation rules.
            </p>
          </div>
        </div>
      </div>

      {errors.form && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 flex items-start space-x-2">
          <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <span>{errors.form}</span>
        </div>
      )}

      {/* Duplicate Warning Alert */}
      {duplicateWarning && (
        <div className={`rounded-xl border p-4 text-xs space-y-1.5 shadow-sm ${
          duplicateWarning.type === 'DUPLICATE_SERIAL_ID'
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : duplicateWarning.type === 'DUPLICATE_EPIC_NUMBER'
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : 'bg-purple-50 border-purple-300 text-purple-900'
        }`}>
          <div className="flex items-center font-bold text-sm">
            <AlertTriangle className={`h-4 w-4 mr-1.5 flex-shrink-0 ${
              duplicateWarning.type === 'DUPLICATE_SERIAL_ID'
                ? 'text-amber-600'
                : duplicateWarning.type === 'DUPLICATE_EPIC_NUMBER'
                ? 'text-rose-600'
                : 'text-purple-600'
            }`} />
            <span>
              {duplicateWarning.type === 'DUPLICATE_SERIAL_ID'
                ? '⚠️ Conflicting Booth Serial Number Detected'
                : duplicateWarning.type === 'DUPLICATE_EPIC_NUMBER'
                ? '⚠️ Conflicting EPIC Number Detected'
                : '⚠️ Potential Duplicate Record Detected'}
              {' '}({duplicateWarning.confidence}% Match)
            </span>
          </div>
          <p className="leading-relaxed">
            Existing voter record matched: <strong>{duplicateWarning.candidate.fullName}</strong>
            {duplicateWarning.candidate.boothSerialNumber && ` (Booth Serial: #${duplicateWarning.candidate.boothSerialNumber})`}
            {duplicateWarning.candidate.epicNumber && ` (EPIC: ${duplicateWarning.candidate.epicNumber})`}.
            <br />
            <strong>Reason:</strong> {duplicateWarning.reason}.
          </p>
          <p className="text-[11px] opacity-80">
            If you proceed with registration, this entry will be flagged for review in the Duplicate Records audit queue.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Identification & Personal Info */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            1. Electoral Identification & Identity
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Booth Serial Number (Primary Roll ID) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={boothSerialNumber}
                onChange={(e) => setBoothSerialNumber(e.target.value)}
                onBlur={handleCheckDuplicates}
                placeholder="e.g. 1, 2, 145"
                className={`w-full rounded-md border px-3 py-2 text-base sm:text-sm font-mono font-bold focus:outline-none ${
                  errors.boothSerialNumber ? 'border-rose-400' : 'border-slate-300 focus:border-brand-600'
                }`}
              />
              {errors.boothSerialNumber && <p className="text-xs text-rose-500 mt-1">{errors.boothSerialNumber}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={handleCheckDuplicates}
                placeholder="e.g. Harpreet Singh Sandhu"
                className={`w-full rounded-md border px-3 py-2 text-base sm:text-sm focus:outline-none ${
                  errors.fullName ? 'border-rose-400' : 'border-slate-300 focus:border-brand-600'
                }`}
              />
              {errors.fullName && <p className="text-xs text-rose-500 mt-1">{errors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official EPIC Identifier <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={epicNumber}
                onChange={(e) => setEpicNumber(e.target.value.toUpperCase())}
                onBlur={handleCheckDuplicates}
                placeholder="e.g. PB1049281 (Optional)"
                className={`w-full rounded-md border px-3 py-2 text-base sm:text-sm font-mono font-semibold uppercase focus:outline-none ${
                  errors.epicNumber ? 'border-rose-400' : 'border-slate-300 focus:border-brand-600'
                }`}
              />
              {errors.epicNumber && <p className="text-xs text-rose-500 mt-1">{errors.epicNumber}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile / Contact Number <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="e.g. 9814012345"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm font-mono focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Relative / Guardian Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={relativeName}
                onChange={(e) => setRelativeName(e.target.value)}
                onBlur={handleCheckDuplicates}
                placeholder="e.g. Rajesh Patel"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship Type</label>
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Husband">Husband</option>
                <option value="Other">Other / Legal Guardian</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Third Gender">Third Gender</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Age (18-120) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min={18}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth (Optional)</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Family Notation & Household Relationship */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 gap-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800">
              2. Family Roll Notation & Household Linkage
            </h2>
            <span className="text-xs text-slate-500 font-medium">Designate role: FH, FM, or SM</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label
              className={`p-3 rounded-lg border cursor-pointer transition flex items-start space-x-3 ${
                familyRole === 'SM'
                  ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="familyRole"
                value="SM"
                checked={familyRole === 'SM'}
                onChange={() => {
                  setFamilyRole('SM');
                  setFamilyHeadId('');
                }}
                className="mt-0.5 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <div className="font-semibold text-xs text-slate-900">SM — Single Member</div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Individual elector living alone or independent voter.
                </p>
              </div>
            </label>

            <label
              className={`p-3 rounded-lg border cursor-pointer transition flex items-start space-x-3 ${
                familyRole === 'FH'
                  ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="familyRole"
                value="FH"
                checked={familyRole === 'FH'}
                onChange={() => {
                  setFamilyRole('FH');
                  setFamilyHeadId('');
                }}
                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <div className="font-semibold text-xs text-slate-900">FH — Family Head</div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Designated head of household. Family members will link to this record.
                </p>
              </div>
            </label>

            <label
              className={`p-3 rounded-lg border cursor-pointer transition flex items-start space-x-3 ${
                familyRole === 'FM'
                  ? 'border-purple-500 bg-purple-50/50 ring-1 ring-purple-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="familyRole"
                value="FM"
                checked={familyRole === 'FM'}
                onChange={() => setFamilyRole('FM')}
                className="mt-0.5 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <div className="font-semibold text-xs text-slate-900">FM — Family Member</div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Dependent or relative linked to an existing Family Head (FH).
                </p>
              </div>
            </label>
          </div>

          {familyRole === 'FM' && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Family Head (FH) <span className="text-rose-500">*</span>
              </label>
              <select
                value={familyHeadId}
                onChange={(e) => setFamilyHeadId(e.target.value)}
                required
                className={`w-full rounded-md border px-3 py-2 text-base sm:text-xs focus:outline-none ${
                  errors.familyHeadId ? 'border-rose-400' : 'border-slate-300 focus:border-brand-600'
                }`}
              >
                <option value="">-- Choose Family Head (FH) --</option>
                {familyHeads?.map((h) => (
                  <option key={h._id || h.id} value={h._id || h.id}>
                    [Booth Sl #{h.boothSerialNumber}] {h.fullName} {h.epicNumber ? `(EPIC: ${h.epicNumber})` : ''}
                  </option>
                ))}
              </select>
              {errors.familyHeadId && <p className="text-xs text-rose-500 mt-1">{errors.familyHeadId}</p>}
              {(!familyHeads || familyHeads.length === 0) && (
                <p className="text-[11px] text-amber-600 mt-1.5">
                  ⚠️ No Family Heads (FH) registered in this booth yet. Please register or designate the Family Head first, or select their booth.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Section 3: Residential Address & Google Places */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            3. Verified Residential Address
          </h2>

          <AddressAutocomplete value={address} onChange={(newAddr) => setAddress(newAddr)} errors={errors} />
        </div>

        {/* Section 4: Official Polling Station Booth Assignment */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            4. Polling Station & Electoral Roll Association
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Official Polling Booth
            </label>
            <select
              value={pollingStationId}
              onChange={(e) => setPollingStationId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
            >
              <option value="">-- Unassigned (Flag as Data Quality Review) --</option>
              {booths?.map((b) => (
                <option key={b._id || b.id} value={b._id || b.id}>
                  Booth #{b.officialBoothNumber} — {b.stationName} ({b.electoralArea})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              * Note: In accordance with ECI guidelines, a voter must only be associated with an officially gazetted booth.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-3">
          <button
            type="button"
            onClick={() => navigate('/voters')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:opacity-50 transition"
          >
            <Save className="h-4 w-4" />
            <span>{isSubmitting ? 'Persisting Record...' : 'Save Voter Record'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddVoterPage;
