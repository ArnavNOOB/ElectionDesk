import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { communicationApi } from '../api/client';
import {
  Phone,
  MessageSquare,
  Clock,
  User,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  PhoneCall,
  Send,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';

export function CommunicationHistoryTimeline({ voterId, onRefreshNeeded }) {
  const [channelFilter, setChannelFilter] = useState('ALL'); // 'ALL' | 'PHONE' | 'WHATSAPP'

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['voter-communication-history', voterId],
    queryFn: async () => {
      const res = await communicationApi.getHistory(voterId, { limit: 100 });
      return res.data.data;
    },
    enabled: Boolean(voterId),
  });

  const logs = data?.history || [];
  const filteredLogs = logs.filter((l) => {
    if (channelFilter !== 'ALL' && l.channel !== channelFilter) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
      case 'DELIVERED':
      case 'READ':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {status}
          </span>
        );
      case 'SENT':
      case 'QUEUED':
      case 'IN_PROGRESS':
      case 'RINGING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            {status}
          </span>
        );
      case 'INITIATED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
      case 'FAILED':
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {status}
          </span>
        );
      case 'OPTED_OUT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            OPTED OUT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const getModeLabel = (mode) => {
    switch (mode) {
      case 'DEVICE_TEL':
        return 'Device Native Call';
      case 'BROWSER_VOIP':
        return 'Browser VoIP Session';
      case 'WHATSAPP_CLOUD_API':
        return 'Meta WhatsApp Cloud API';
      case 'WHATSAPP_DIRECT_LINK':
        return 'Direct WhatsApp (wa.me)';
      default:
        return mode;
    }
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="h-7 w-7 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 font-bold text-xs">
            CL
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Communication & Contact History
            </h2>
            <p className="text-[11px] text-slate-400">
              Access-controlled log of voice calls, WhatsApp advisories, and delivery receipts
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Channel Filter Pill */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs text-slate-600">
            <button
              type="button"
              onClick={() => setChannelFilter('ALL')}
              className={`px-2 py-1 rounded font-medium transition ${
                channelFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              All ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter('PHONE')}
              className={`px-2 py-1 rounded font-medium transition flex items-center space-x-1 ${
                channelFilter === 'PHONE' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              <Phone className="h-3 w-3" />
              <span>Calls</span>
            </button>
            <button
              type="button"
              onClick={() => setChannelFilter('WHATSAPP')}
              className={`px-2 py-1 rounded font-medium transition flex items-center space-x-1 ${
                channelFilter === 'WHATSAPP' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              <MessageSquare className="h-3 w-3" />
              <span>WhatsApp</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition"
            title="Refresh History Timeline"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center space-y-2">
          <RefreshCw className="h-5 w-5 text-brand-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading communication logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-10 text-center space-y-2 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          <Clock className="h-8 w-8 text-slate-300 mx-auto" />
          <p className="text-xs font-medium text-slate-600">No communication records found</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Authorized staff can initiate permitted calls and official WhatsApp messages using the action buttons above.
          </p>
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-200 ml-4 space-y-4 my-2">
          {filteredLogs.map((log) => {
            const isWhatsApp = log.channel === 'WHATSAPP';
            return (
              <div key={log._id || log.id} className="relative pl-6">
                {/* Timeline Node Bullet */}
                <span
                  className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white shadow-xs flex items-center justify-center ${
                    isWhatsApp ? 'bg-[#128C7E]' : 'bg-brand-600'
                  }`}
                />

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 shadow-2xs hover:border-slate-300 transition">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-xs text-slate-900 flex items-center">
                        {isWhatsApp ? (
                          <MessageSquare className="h-3.5 w-3.5 text-[#128C7E] mr-1.5" />
                        ) : (
                          <Phone className="h-3.5 w-3.5 text-brand-600 mr-1.5" />
                        )}
                        {isWhatsApp ? 'WhatsApp Message' : 'Voice Call'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium px-2 py-0.5 rounded bg-slate-100">
                        {getModeLabel(log.mode)}
                      </span>
                      {getStatusBadge(log.status)}
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Details Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-50">
                    <div>
                      <span className="text-slate-400 block font-medium">Recipient (Masked):</span>
                      <span className="font-mono text-slate-800">{log.recipientPhoneMasked}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block font-medium">Initiating Staff:</span>
                      <span className="text-slate-800 font-medium">{log.staffEmail} ({log.staffRole})</span>
                    </div>

                    <div>
                      {isWhatsApp ? (
                        <>
                          <span className="text-slate-400 block font-medium">Statutory Template:</span>
                          <span className="text-brand-700 font-mono font-medium">{log.templateId || 'Direct'}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-400 block font-medium">Call Duration:</span>
                          <span className="font-mono text-slate-800">
                            {log.durationSeconds ? `${log.durationSeconds}s` : 'Initiated'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {log.providerReferenceId && (
                    <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1">
                      <span>Provider Ref: {log.providerReferenceId}</span>
                      <span>Consent: {log.consentReference?.status || 'OPTED_IN'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CommunicationHistoryTimeline;
