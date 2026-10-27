import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Mail, Phone, Lock } from 'lucide-react';

export function AccountRecoveryPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-amber-500 items-center justify-center text-white shadow-xl mb-3">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Privileged Account Recovery</h2>
        <p className="mt-1 text-xs text-slate-400 font-medium tracking-wide uppercase">
          Identity Verification & Session Restoration Policy
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-slate-200">
          <div className="text-sm text-slate-700 space-y-4">
            <p>
              In accordance with Election Commission security baselines, automatic password resets via public email links are restricted for privileged electoral administrative roles.
            </p>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
              <h4 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                Approved Recovery Procedures:
              </h4>
              <div className="flex items-start space-x-2 text-xs text-slate-600">
                <Lock className="h-4 w-4 text-brand-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>MFA Device Lost:</strong> Use one of the 6 emergency backup recovery codes generated during your initial MFA setup.
                </span>
              </div>
              <div className="flex items-start space-x-2 text-xs text-slate-600">
                <Mail className="h-4 w-4 text-brand-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Forgotten Credentials:</strong> Contact your appointed Super Administrator or Electoral District IT Cell.
                </span>
              </div>
              <div className="flex items-start space-x-2 text-xs text-slate-600">
                <Phone className="h-4 w-4 text-brand-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Helpline:</strong> Official ECI Helpdesk at <span className="font-mono">1950</span> (Toll-Free).
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Upon account recovery, all active session tokens are immediately revoked, and a cryptographic security audit record is permanently preserved.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-500"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Return to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountRecoveryPage;
