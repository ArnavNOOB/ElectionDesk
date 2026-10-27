import React, { useState, useEffect } from 'react';
import { communicationApi } from '../api/client';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  Phone,
  MessageSquare,
  FileText,
  Clock,
} from 'lucide-react';

export function ConsentManagementModal({ isOpen, onClose, voter, onConsentUpdated }) {
  const [status, setStatus] = useState('OPTED_IN');
  const [voiceConsent, setVoiceConsent] = useState(true);
  const [whatsappConsent, setWhatsappConsent] = useState(true);
  const [source, setSource] = useState('ELECTORAL_ROLL_REGISTRATION');
  const [optOutReason, setOptOutReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (voter) {
      const consent = voter.communicationConsent || {};
      setStatus(consent.status || 'OPTED_IN');
      setVoiceConsent(consent.channelConsent?.voice !== undefined ? consent.channelConsent.voice : true);
      setWhatsappConsent(
        consent.channelConsent?.whatsapp !== undefined ? consent.channelConsent.whatsapp : true
      );
      setSource(consent.source || 'ELECTORAL_ROLL_REGISTRATION');
      setOptOutReason(consent.optOutReason || '');
      setError('');
    }
  }, [voter, isOpen]);

  if (!isOpen || !voter) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError('');

      await communicationApi.updateConsent(voter._id || voter.id, {
        status,
        channelConsent: {
          voice: voiceConsent,
          whatsapp: whatsappConsent,
        },
        source,
        optOutReason: status === 'OPTED_OUT' || status === 'REVOKED' ? optOutReason : null,
      });

      if (onConsentUpdated) onConsentUpdated();
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      setError(err.response?.data?.error?.message || err.message || 'Failed to update consent preferences.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center shadow">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Communication Consent Registry</h3>
              <p className="text-[11px] text-slate-400">DPDP Act 2023 Statutory Preference Center</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs text-slate-700">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="font-semibold text-slate-900 text-sm">{voter.fullName}</span>
            <div className="text-[11px] text-slate-500 font-mono">
              Phone: {voter.mobileNumber || 'Not provided'} • Booth #{voter.boothSerialNumber || '—'}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Consent Status Selection */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700">Overall Messaging Consent Status</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('OPTED_IN')}
                className={`p-2.5 rounded-lg border text-center font-medium transition ${
                  status === 'OPTED_IN'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-100 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                ✓ Opted-In (Active)
              </button>

              <button
                type="button"
                onClick={() => setStatus('OPTED_OUT')}
                className={`p-2.5 rounded-lg border text-center font-medium transition ${
                  status === 'OPTED_OUT' || status === 'REVOKED'
                    ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-100 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                ✕ Opted-Out (Suppressed)
              </button>
            </div>
          </div>

          {/* Channel Preferences */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block font-semibold text-slate-700">Authorized Channels</label>
            <div className="space-y-2">
              <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center space-x-2.5">
                  <Phone className="h-4 w-4 text-brand-600" />
                  <div>
                    <span className="font-semibold text-xs text-slate-800 block">Voice Telephone Calls</span>
                    <span className="text-[10px] text-slate-400">Official election advisories & verification calls</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={voiceConsent}
                  onChange={(e) => setVoiceConsent(e.target.checked)}
                  disabled={status === 'OPTED_OUT'}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center space-x-2.5">
                  <MessageSquare className="h-4 w-4 text-[#128C7E]" />
                  <div>
                    <span className="font-semibold text-xs text-slate-800 block">Official WhatsApp Messages</span>
                    <span className="text-[10px] text-slate-400">Voter slips & polling booth venue guides</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={whatsappConsent}
                  onChange={(e) => setWhatsappConsent(e.target.checked)}
                  disabled={status === 'OPTED_OUT'}
                  className="h-4 w-4 rounded border-slate-300 text-[#128C7E] focus:ring-[#128C7E] disabled:opacity-40"
                />
              </label>
            </div>
          </div>

          {/* Consent Source */}
          <div className="space-y-1">
            <label className="block font-semibold text-slate-700">Consent Verification Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-brand-600 focus:outline-none"
            >
              <option value="ELECTORAL_ROLL_REGISTRATION">Electoral Roll Registration (Form 6/8)</option>
              <option value="DIRECT_IN_PERSON">Direct In-Person Verification Counter</option>
              <option value="SMS_CONFIRMATION">Two-Way SMS Elector Confirmation</option>
              <option value="ONLINE_CONSENT">National Voter Services Online Portal</option>
            </select>
          </div>

          {/* Opt-Out Reason */}
          {(status === 'OPTED_OUT' || status === 'REVOKED') && (
            <div className="space-y-1">
              <label className="block font-semibold text-slate-700">Reason for Opt-Out / Revocation</label>
              <input
                type="text"
                value={optOutReason}
                onChange={(e) => setOptOutReason(e.target.value)}
                placeholder="e.g. Elector requested Do-Not-Disturb"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-brand-600 focus:outline-none"
              />
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 leading-relaxed">
            Elector maintains statutory right under <strong>DPDP Act 2023</strong> to withdraw or modify communication consent at any time without impacting voter registration status or electoral eligibility.
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium text-xs hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center space-x-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Consent Preferences</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ConsentManagementModal;
