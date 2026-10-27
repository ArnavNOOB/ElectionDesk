import React, { useState, useEffect } from 'react';
import { communicationApi } from '../api/client';
import {
  MessageSquare,
  Send,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  X,
  RefreshCw,
  Copy,
  Info,
} from 'lucide-react';

const APPROVED_TEMPLATES = [
  {
    id: 'VOTER_SLIP_ADVISORY',
    name: 'Official Voter Slip & Polling Serial Advisory',
    category: 'UTILITY',
    description: 'Advises voter of their designated polling booth number, serial number, and EPIC.',
    templateText:
      'Namaste {{voter_name}}, your voter slip for Booth #{{booth_number}} ({{booth_name}}) in {{electoral_area}} is ready. Voter Serial No: #{{serial_number}}, EPIC: {{epic_number}}. Issued by ElectionDesk Patiala Urban.',
    defaultVars: (v) => ({
      voter_name: v.fullName || '',
      booth_number: v.pollingStationId?.officialBoothNumber || '42',
      booth_name: v.pollingStationId?.stationName || 'Govt Multipurpose Senior Secondary School',
      electoral_area: v.pollingStationId?.electoralArea || v.address?.villageWard || 'Ward 12',
      serial_number: String(v.boothSerialNumber || '—'),
      epic_number: v.epicNumber || 'Not Issued',
    }),
  },
  {
    id: 'POLLING_BOOTH_LOCATION',
    name: 'Polling Station Location & Venue Guide',
    category: 'UTILITY',
    description: 'Provides exact street address, ward, and poll day operational hours.',
    templateText:
      'Namaste {{voter_name}}, your designated polling station for {{electoral_area}} is located at: {{booth_name}}, {{booth_address}}. Nearest landmark: Patiala Urban. Poll Hours: 7:00 AM - 6:00 PM.',
    defaultVars: (v) => ({
      voter_name: v.fullName || '',
      electoral_area: v.pollingStationId?.electoralArea || v.address?.villageWard || 'Ward 12',
      booth_name: v.pollingStationId?.stationName || 'Govt Multipurpose Senior Secondary School',
      booth_address: v.pollingStationId?.address || 'Passi Road, Near Model Town, Patiala, Punjab 147001',
    }),
  },
  {
    id: 'REGISTRATION_STATUS_UPDATE',
    name: 'Electoral Roll Verification Status Notice',
    category: 'UTILITY',
    description: 'Informs voter of their physical verification outcome.',
    templateText:
      'Namaste {{voter_name}}, your electoral roll record verification status is currently: {{verification_status}}. Reference ID: {{record_ref}}. For any discrepancies, contact your local Electoral Registration Officer.',
    defaultVars: (v) => ({
      voter_name: v.fullName || '',
      verification_status: v.verificationStatus || 'Verified',
      record_ref: v._id ? String(v._id).slice(-8).toUpperCase() : 'REF-2026',
    }),
  },
  {
    id: 'DOCUMENTATION_ASSISTANCE',
    name: 'Electoral Documentation & Helpdesk Advisory',
    category: 'UTILITY',
    description: 'Directs elector to administrative helpdesk room for documentation assistance.',
    templateText:
      'Namaste {{voter_name}}, regarding your electoral record inquiry, the Patiala Urban Election Helpdesk is available at Room {{booth_number}}, {{booth_name}}. Helpline: 1950.',
    defaultVars: (v) => ({
      voter_name: v.fullName || '',
      booth_number: v.pollingStationId?.officialBoothNumber || '42',
      booth_name: v.pollingStationId?.stationName || 'Govt Multipurpose Senior Secondary School',
    }),
  },
];

export function WhatsAppComposerModal({ isOpen, onClose, voter, onMessageSent }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('VOTER_SLIP_ADVISORY');
  const [variables, setVariables] = useState({});
  const [mode, setMode] = useState('WHATSAPP_CLOUD_API'); // 'WHATSAPP_CLOUD_API' | 'WHATSAPP_DIRECT_LINK'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  // Initialize variables when template or voter changes
  useEffect(() => {
    if (voter) {
      const tmpl = APPROVED_TEMPLATES.find((t) => t.id === selectedTemplateId) || APPROVED_TEMPLATES[0];
      setVariables(tmpl.defaultVars(voter));
      setError('');
      setSuccessInfo(null);
    }
  }, [selectedTemplateId, voter, isOpen]);

  if (!isOpen || !voter) return null;

  const currentTemplate =
    APPROVED_TEMPLATES.find((t) => t.id === selectedTemplateId) || APPROVED_TEMPLATES[0];

  // Render live preview text
  let renderedPreview = currentTemplate.templateText;
  for (const [key, val] of Object.entries(variables)) {
    renderedPreview = renderedPreview.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `[${key}]`);
  }

  const consentStatus = voter.communicationConsent?.status || 'OPTED_IN';
  const isOptedOut = consentStatus === 'OPTED_OUT' || consentStatus === 'REVOKED';

  const handleSend = async () => {
    try {
      setIsSubmitting(true);
      setError('');

      // Unique idempotency key to prevent double sends
      const idempotencyKey = `wa_${voter._id || voter.id}_${selectedTemplateId}_${Date.now()}`;

      const res = await communicationApi.sendWhatsAppMessage({
        voterId: voter._id || voter.id,
        templateId: selectedTemplateId,
        templateVariables: variables,
        mode,
        idempotencyKey,
        clientConfirmed: true,
      });

      const data = res.data.data;
      setSuccessInfo(data);

      if (mode === 'WHATSAPP_DIRECT_LINK' && data.directUrl) {
        window.open(data.directUrl, '_blank', 'noopener,noreferrer');
      }

      if (onMessageSent) onMessageSent();

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1500);
    } catch (err) {
      setIsSubmitting(false);
      setError(err.response?.data?.error?.message || err.message || 'WhatsApp message dispatch failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-[#128C7E] text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shadow">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Official WhatsApp Message Composer</h3>
              <p className="text-[11px] text-white/80">Meta WhatsApp Business Platform Cloud API</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-black/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
          {/* Recipient & Consent Pill */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-bold text-sm text-slate-900">{voter.fullName}</span>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                Recipient: <strong className="text-slate-800">{voter.mobileNumber || 'No phone number'}</strong> • EPIC: {voter.epicNumber || '—'}
              </div>
            </div>
            <div>
              {isOptedOut ? (
                <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-[11px] flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Opted-Out / Suppressed
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-[11px] flex items-center">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Messaging Consent Verified
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>Message dispatched successfully! Status: <strong>{successInfo.status}</strong></span>
            </div>
          )}

          {/* Template Selection */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700">Select Approved Statutory Template</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#128C7E] focus:outline-none"
            >
              {APPROVED_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name} ({tmpl.category})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 italic">{currentTemplate.description}</p>
          </div>

          {/* Template Variables Customization */}
          <div className="space-y-2">
            <label className="block font-semibold text-slate-700">Template Variables</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {Object.keys(variables).map((varKey) => (
                <div key={varKey}>
                  <span className="block text-[10px] font-mono font-medium text-slate-500 uppercase">
                    {`{{${varKey}}}`}
                  </span>
                  <input
                    type="text"
                    value={variables[varKey] || ''}
                    onChange={(e) => setVariables({ ...variables, [varKey]: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-xs bg-white focus:border-[#128C7E] focus:outline-none font-medium text-slate-800"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Live WhatsApp Bubble Preview */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700 flex items-center justify-between">
              <span>Live Rendered WhatsApp Preview</span>
              <span className="text-[11px] font-normal text-slate-400">
                {renderedPreview.length} characters • Non-Partisan Validated
              </span>
            </label>
            <div className="p-4 bg-[#E5DDD5] rounded-xl border border-slate-300/80 shadow-inner flex flex-col items-start">
              <div className="bg-[#DCF8C6] p-3 rounded-lg rounded-tl-none shadow max-w-[90%] text-slate-800 text-xs leading-relaxed relative">
                <p>{renderedPreview}</p>
                <div className="flex items-center justify-end space-x-1 mt-1.5 text-[10px] text-slate-400 font-mono">
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-[#34B7F1] font-bold">✓✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dispatch Channel Options */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700">Dispatch Delivery Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('WHATSAPP_CLOUD_API')}
                className={`p-3 rounded-xl border text-left transition ${
                  mode === 'WHATSAPP_CLOUD_API'
                    ? 'bg-emerald-50/60 border-[#128C7E] ring-2 ring-emerald-100'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Send className="h-4 w-4 text-[#128C7E]" />
                  <span className="font-semibold text-xs text-slate-900">Official Cloud API</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Dispatches via Meta Cloud API with automated delivery tracking and verified sender badge.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('WHATSAPP_DIRECT_LINK')}
                className={`p-3 rounded-xl border text-left transition ${
                  mode === 'WHATSAPP_DIRECT_LINK'
                    ? 'bg-emerald-50/60 border-[#128C7E] ring-2 ring-emerald-100'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <ExternalLink className="h-4 w-4 text-[#128C7E]" />
                  <span className="font-semibold text-xs text-slate-900">Open in WhatsApp</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Opens WhatsApp Web or App (<code className="text-emerald-700 font-mono">wa.me</code>) with prefilled approved text for review.
                </p>
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-[10px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <Shield className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
            <span>
              Adheres to WhatsApp Business Messaging Policy & DPDP Act 2023. Inbound keywords like <code className="font-bold text-slate-700">STOP</code> automatically update suppression lists.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium text-xs hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSubmitting || isOptedOut || !voter.mobileNumber}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-[#128C7E] hover:bg-[#075E54] text-white font-semibold text-xs disabled:opacity-50 transition shadow-sm cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Processing Send...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>{mode === 'WHATSAPP_CLOUD_API' ? 'Send Official WhatsApp' : 'Open in WhatsApp App'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppComposerModal;
