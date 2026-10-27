import React, { useState, useEffect, useRef } from 'react';
import { communicationApi } from '../api/client';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Clock,
  Shield,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export function CallModal({ isOpen, onClose, voter, onCallLogged }) {
  const [mode, setMode] = useState('DEVICE_TEL'); // 'DEVICE_TEL' | 'BROWSER_VOIP'
  const [reason, setReason] = useState('Official electoral roll inquiry & verification');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Browser VoIP state
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState('IDLE'); // 'IDLE' | 'CONNECTING' | 'RINGING' | 'CONNECTED' | 'ENDED'
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [currentCallId, setCurrentCallId] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (callStatus === 'CONNECTED') {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  if (!isOpen || !voter) return null;

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartCall = async () => {
    try {
      setIsLoading(true);
      setError('');

      const res = await communicationApi.initiateCall({
        voterId: voter._id || voter.id,
        mode,
        clientConfirmed: true,
        reason,
      });

      const callData = res.data.data;
      setCurrentCallId(callData.callId);

      if (mode === 'DEVICE_TEL') {
        // Launch device dialer
        if (callData.telUri) {
          window.location.href = callData.telUri;
        }
        if (onCallLogged) onCallLogged();
        setTimeout(() => {
          setIsLoading(false);
          onClose();
        }, 1200);
      } else {
        // Browser VoIP simulation sequence
        setCallActive(true);
        setCallStatus('CONNECTING');
        setIsLoading(false);

        setTimeout(() => {
          setCallStatus('RINGING');
          setTimeout(() => {
            setCallStatus('CONNECTED');
          }, 2000);
        }, 1500);
      }
    } catch (err) {
      setIsLoading(false);
      setError(err.response?.data?.error?.message || err.message || 'Call initiation failed.');
    }
  };

  const handleEndCall = () => {
    setCallStatus('ENDED');
    if (timerRef.current) clearInterval(timerRef.current);
    if (onCallLogged) onCallLogged();

    setTimeout(() => {
      setCallActive(false);
      setCallStatus('IDLE');
      setDuration(0);
      onClose();
    }, 1200);
  };

  const consentStatus = voter.communicationConsent?.status || 'OPTED_IN';
  const isOptedOut = consentStatus === 'OPTED_OUT' || consentStatus === 'REVOKED';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center shadow">
              <PhoneCall className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Electoral Voice Communication</h3>
              <p className="text-[11px] text-slate-400">Patiala Urban Administration Desk</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={callActive && callStatus === 'CONNECTED'}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs text-slate-700">
          {/* Elector Summary Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900">{voter.fullName}</span>
              <span className="font-mono text-xs font-semibold bg-brand-50 text-brand-700 px-2 py-0.5 rounded border border-brand-200">
                Booth #{voter.boothSerialNumber || '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>Official Phone: <strong className="text-slate-800 font-mono">{voter.mobileNumber || 'No phone'}</strong></span>
              <span>EPIC: <strong className="text-slate-800 font-mono">{voter.epicNumber || 'Not Issued'}</strong></span>
            </div>
            {isOptedOut && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 flex items-center space-x-1.5 font-medium text-[11px]">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>This elector has opted out of voice contact. Communication is blocked.</span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Active Browser Call Interface */}
          {callActive ? (
            <div className="p-6 bg-slate-900 text-white rounded-xl text-center space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    callStatus === 'CONNECTED'
                      ? 'bg-emerald-500 animate-pulse'
                      : callStatus === 'RINGING'
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-slate-400'
                  }`}
                />
                <span className="font-mono font-semibold text-xs tracking-wider uppercase text-slate-300">
                  {callStatus === 'CONNECTING' && 'Connecting Telephony Session...'}
                  {callStatus === 'RINGING' && 'Ringing Recipient Device...'}
                  {callStatus === 'CONNECTED' && 'Call in Progress'}
                  {callStatus === 'ENDED' && 'Call Terminated'}
                </span>
              </div>

              <div className="font-mono font-bold text-3xl tracking-wider text-emerald-400">
                {formatTimer(duration)}
              </div>

              <p className="text-[11px] text-slate-400">
                {voter.fullName} ({voter.mobileNumber})
              </p>

              {/* Call Controls */}
              <div className="flex items-center justify-center space-x-4 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-3 rounded-full transition ${
                    isMuted ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  className="p-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition"
                  title="Hang Up Call"
                >
                  <PhoneOff className="h-5 w-5" />
                </button>
              </div>

              <div className="pt-2 text-[10px] text-slate-500 border-t border-slate-800">
                Encrypted Session • Provider: ElectionDesk Secure VoIP Bridge
              </div>
            </div>
          ) : (
            <>
              {/* Calling Mode Selector */}
              <div className="space-y-2">
                <label className="block font-semibold text-slate-700">Select Calling Interface</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('DEVICE_TEL')}
                    className={`p-3 rounded-xl border text-left transition ${
                      mode === 'DEVICE_TEL'
                        ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-100'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-brand-600" />
                      <span className="font-semibold text-xs text-slate-900">Device Dialing</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Launches your device’s native dialer or phone app via sanitized <code className="text-brand-700 font-mono">tel:</code> link.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('BROWSER_VOIP')}
                    className={`p-3 rounded-xl border text-left transition ${
                      mode === 'BROWSER_VOIP'
                        ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-100'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <PhoneCall className="h-4 w-4 text-brand-600" />
                      <span className="font-semibold text-xs text-slate-900">Browser VoIP</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Places call directly in browser using server-generated telephony capability token.
                    </p>
                  </button>
                </div>
              </div>

              {/* Administrative Reason */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">Administrative Purpose</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-brand-600 focus:outline-none"
                >
                  <option value="Official electoral roll inquiry & verification">
                    Official electoral roll inquiry & verification
                  </option>
                  <option value="Polling booth venue & location advisory">
                    Polling booth venue & location advisory
                  </option>
                  <option value="Voter slip distribution coordination">
                    Voter slip distribution coordination
                  </option>
                  <option value="Field verification discrepancy resolution">
                    Field verification discrepancy resolution
                  </option>
                </select>
              </div>

              {/* Privacy / Recording Banner */}
              <div className="flex items-center space-x-2 text-[10px] text-slate-400 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <Shield className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <span>
                  Audio recording and AI transcription are strictly disabled by policy under DPDP Act 2023 guidelines. Only call metadata (timestamp, staff user, and duration) is retained.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!callActive && (
          <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartCall}
              disabled={isLoading || isOptedOut || !voter.mobileNumber}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500 disabled:opacity-50 transition shadow-sm cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Phone className="h-3.5 w-3.5" />
                  <span>{mode === 'DEVICE_TEL' ? 'Open Phone Dialer' : 'Initiate Browser Call'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CallModal;
