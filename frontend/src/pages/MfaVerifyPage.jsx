import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, KeyRound, AlertCircle, ArrowLeft } from 'lucide-react';

export function MfaVerifyPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isBackupMode, setIsBackupMode] = useState(false);

  const { verifyMfa, mfaChallenge } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code) {
      setError('Please enter your verification code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await verifyMfa(code);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'MFA Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-14 w-14 rounded-2xl bg-brand-600 items-center justify-center text-white shadow-xl mb-3">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Two-Factor Verification</h2>
        <p className="mt-1 text-xs text-slate-400 font-medium tracking-wide uppercase">
          Enter Authenticator TOTP or Backup Code
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-slate-200">
          <p className="text-sm text-slate-600 mb-5">
            {isBackupMode
              ? 'Enter one of your 8-character single-use emergency backup recovery codes.'
              : 'Open your Authenticator app (Google Authenticator, Microsoft Authenticator, or 1Password) and enter the 6-digit code.'}
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                {isBackupMode ? '8-Character Backup Code' : '6-Digit TOTP Passcode'}
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={isBackupMode ? 12 : 6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={isBackupMode ? 'e.g. A1B2C3D4' : '000 000'}
                  className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-3 text-lg font-mono font-bold tracking-widest text-slate-900 placeholder-slate-300 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 text-center"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center rounded-lg bg-brand-600 py-2.5 px-4 text-sm font-semibold text-white shadow-md hover:bg-brand-500 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Authenticate Session'}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsBackupMode(!isBackupMode);
                setCode('');
                setError('');
              }}
              className="text-brand-600 hover:text-brand-700 font-medium hover:underline"
            >
              {isBackupMode ? '← Use Authenticator app code' : 'Lost device? Use emergency backup code'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-slate-500 hover:text-slate-700 flex items-center"
            >
              <ArrowLeft className="h-3 w-3 mr-1" /> Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MfaVerifyPage;
