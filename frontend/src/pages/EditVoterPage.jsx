import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { voterApi, boothApi } from '../api/client';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { ArrowLeft, Save, AlertTriangle, CheckCircle } from 'lucide-react';

export function EditVoterPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formState, setFormState] = useState(null);
  const [initialState, setInitialState] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch initial record
  const { data: voter, isLoading } = useQuery({
    queryKey: ['voter-details', id],
    queryFn: async () => {
      const res = await voterApi.getById(id);
      return res.data.data;
    },
  });

  // Fetch polling booths
  const { data: booths } = useQuery({
    queryKey: ['booths-list'],
    queryFn: async () => {
      const res = await boothApi.list();
      return res.data.data || [];
    },
  });

  // Fetch family heads for the assigned booth
  const { data: familyHeads } = useQuery({
    queryKey: ['family-heads', formState?.pollingStationId],
    queryFn: async () => {
      const res = await voterApi.getFamilyHeads({
        pollingStationId: formState?.pollingStationId || undefined,
      });
      return (res.data.data || []).filter((h) => String(h._id || h.id) !== String(id));
    },
    enabled: !!formState,
  });

  useEffect(() => {
    if (voter && !formState) {
      const initial = {
        boothSerialNumber: voter.boothSerialNumber || '',
        epicNumber: voter.epicNumber || '',
        mobileNumber: voter.mobileNumber || '',
        fullName: voter.fullName || '',
        relativeName: voter.relativeName || '',
        relationType: voter.relationType || 'Father',
        familyRole: voter.familyRole || 'SM',
        familyHeadId: voter.familyHeadId?._id || voter.familyHeadId?.id || voter.familyHeadId || '',
        gender: voter.gender || 'Male',
        age: voter.age || 18,
        dateOfBirth: voter.dateOfBirth ? voter.dateOfBirth.substring(0, 10) : '',
        address: voter.address || {
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
        },
        pollingStationId: voter.pollingStationId?._id || voter.pollingStationId?.id || voter.pollingStationId || '',
        verificationStatus: voter.verificationStatus || 'Pending_Verification',
      };
      setFormState(initial);
      setInitialState(initial);
    }
  }, [voter, formState]);

  useEffect(() => {
    if (formState && initialState) {
      const changed = JSON.stringify(formState) !== JSON.stringify(initialState);
      setHasChanges(changed);
    }
  }, [formState, initialState]);

  if (isLoading || !formState) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Loading voter record for editing...</p>
        </div>
      </div>
    );
  }

  const handleChange = (field, val) => {
    setFormState((prev) => ({ ...prev, [field]: val }));
  };

  const validate = () => {
    const errs = {};
    const serial = parseInt(formState.boothSerialNumber, 10);
    if (!formState.boothSerialNumber || isNaN(serial) || serial <= 0) {
      errs.boothSerialNumber = 'Booth Serial Number is required (positive integer)';
    }
    if (!formState.fullName.trim()) errs.fullName = 'Full Name is required';
    if (!formState.relativeName.trim()) errs.relativeName = 'Relative Name is required';
    if (!formState.age || formState.age < 18 || formState.age > 120) errs.age = 'Age must be 18 to 120';
    if (!formState.address.pinCode || !/^[1-9][0-9]{5}$/.test(formState.address.pinCode.trim())) {
      errs['address.pinCode'] = 'Valid 6-digit Indian PIN code required';
    }
    if (formState.familyRole === 'FM' && !formState.familyHeadId) {
      errs.familyHeadId = 'Please select a Family Head (FH) for this Family Member';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      const payload = {
        ...formState,
        familyHeadId: formState.familyRole === 'FM' ? formState.familyHeadId : null,
        address: formState.address
          ? {
              ...formState.address,
              latitude:
                formState.address.latitude !== null &&
                formState.address.latitude !== undefined &&
                formState.address.latitude !== ''
                  ? Number(formState.address.latitude)
                  : null,
              longitude:
                formState.address.longitude !== null &&
                formState.address.longitude !== undefined &&
                formState.address.longitude !== ''
                  ? Number(formState.address.longitude)
                  : null,
            }
          : formState.address,
      };
      await voterApi.update(id, payload);
      navigate(`/voters/${id}`);
    } catch (err) {
      setErrors({ form: err.response?.data?.error?.message || err.message || 'Update failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header & Unsaved Changes Alert */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => navigate(`/voters/${id}`)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Edit Voter Record</h1>
            <p className="text-xs text-slate-500">
              Modifying: <span className="font-semibold">{voter.fullName}</span> ({voter.epicNumber})
            </p>
          </div>
        </div>

        {hasChanges && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            ● Unsaved Changes Detected
          </span>
        )}
      </div>

      {errors.form && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 flex items-start space-x-2">
          <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <span>{errors.form}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Personal Info */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            1. Personal & Identity Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Booth Serial Number (Primary ID) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={formState.boothSerialNumber}
                onChange={(e) => handleChange('boothSerialNumber', e.target.value)}
                className={`w-full rounded-md border px-3 py-2 text-base sm:text-sm font-mono font-bold focus:outline-none ${
                  errors.boothSerialNumber ? 'border-rose-400' : 'border-slate-300 focus:border-brand-600'
                }`}
              />
              {errors.boothSerialNumber && <p className="text-xs text-rose-500 mt-1">{errors.boothSerialNumber}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Legal Name</label>
              <input
                type="text"
                required
                value={formState.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
              />
              {errors.fullName && <p className="text-xs text-rose-500 mt-1">{errors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official EPIC Reference</label>
              <input
                type="text"
                value={formState.epicNumber}
                onChange={(e) => handleChange('epicNumber', e.target.value.toUpperCase())}
                placeholder="Optional EPIC Reference"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm font-mono font-semibold uppercase text-slate-700 focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile / Contact Number</label>
              <input
                type="tel"
                value={formState.mobileNumber || ''}
                onChange={(e) => handleChange('mobileNumber', e.target.value)}
                placeholder="e.g. 9814012345"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm font-mono focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Relative Name</label>
              <input
                type="text"
                required
                value={formState.relativeName}
                onChange={(e) => handleChange('relativeName', e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship</label>
              <select
                value={formState.relationType}
                onChange={(e) => handleChange('relationType', e.target.value)}
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
                value={formState.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Third Gender">Third Gender</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
              <input
                type="number"
                min={18}
                max={120}
                value={formState.age}
                onChange={(e) => handleChange('age', parseInt(e.target.value, 10))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Verification Status</label>
              <select
                value={formState.verificationStatus}
                onChange={(e) => handleChange('verificationStatus', e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
              >
                <option value="Pending_Verification">Pending Verification</option>
                <option value="Verified">Verified (Officially Audited)</option>
                <option value="Flagged_Duplicate">Flagged Duplicate</option>
                <option value="Disputed">Disputed Record</option>
              </select>
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
                formState.familyRole === 'SM'
                  ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="familyRole"
                value="SM"
                checked={formState.familyRole === 'SM'}
                onChange={() => {
                  handleChange('familyRole', 'SM');
                  handleChange('familyHeadId', '');
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
                formState.familyRole === 'FH'
                  ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="familyRole"
                value="FH"
                checked={formState.familyRole === 'FH'}
                onChange={() => {
                  handleChange('familyRole', 'FH');
                  handleChange('familyHeadId', '');
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
                formState.familyRole === 'FM'
                  ? 'border-purple-500 bg-purple-50/50 ring-1 ring-purple-500'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="familyRole"
                value="FM"
                checked={formState.familyRole === 'FM'}
                onChange={() => handleChange('familyRole', 'FM')}
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

          {formState.familyRole === 'FM' && (
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Family Head (FH) <span className="text-rose-500">*</span>
              </label>
              <select
                value={formState.familyHeadId}
                onChange={(e) => handleChange('familyHeadId', e.target.value)}
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
            </div>
          )}
        </div>

        {/* Section 3: Address */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            3. Residential Address
          </h2>
          <AddressAutocomplete
            value={formState.address}
            onChange={(newAddr) => handleChange('address', newAddr)}
            errors={errors}
          />
        </div>

        {/* Section 4: Booth Assignment */}
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            4. Polling Station Association
          </h2>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Polling Station</label>
            <select
              value={formState.pollingStationId}
              onChange={(e) => handleChange('pollingStationId', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
            >
              <option value="">-- No Booth Assigned --</option>
              {booths?.map((b) => (
                <option key={b._id || b.id} value={b._id || b.id}>
                  Booth #{b.officialBoothNumber} — {b.stationName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-3">
          <button
            type="button"
            onClick={() => navigate(`/voters/${id}`)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !hasChanges}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:opacity-50 transition"
          >
            <Save className="h-4 w-4" />
            <span>{isSubmitting ? 'Saving Changes...' : 'Save Updates'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditVoterPage;
