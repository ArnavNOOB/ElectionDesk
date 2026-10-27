import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-4">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center shadow-md mb-4">
        <FileQuestion className="h-9 w-9" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">404 — Page Not Found</h1>
      <p className="text-xs text-slate-500 max-w-md mt-2">
        The requested URL was not found on this election management server. Please verify the link or navigate back to the dashboard.
      </p>

      <div className="mt-6 flex space-x-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Go Back
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-600 text-xs font-semibold text-white hover:bg-brand-500 shadow-sm"
        >
          <Home className="h-3.5 w-3.5 mr-1.5" /> Dashboard
        </button>
      </div>
    </div>
  );
}

export default NotFoundPage;
