import React from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

export function StatusBadge({ status }) {
  let colorStyles = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  switch (status) {
    case 'DUPLICATE_SERIAL_ID':
    case 'Duplicate Serial ID':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
          <AlertTriangle className="h-3 w-3 mr-1 text-amber-600 flex-shrink-0" />
          <span>Duplicate Serial ID</span>
        </span>
      );

    case 'DUPLICATE_EPIC_NUMBER':
    case 'Duplicate EPIC':
    case 'Duplicate EPIC Number':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
          <AlertTriangle className="h-3 w-3 mr-1 text-rose-600 flex-shrink-0" />
          <span>Duplicate EPIC</span>
        </span>
      );

    case 'Flagged_Duplicate':
    case 'Disputed':
    case 'POTENTIAL_DUPLICATE_DETECTED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
          <ShieldAlert className="h-3 w-3 mr-1 text-rose-600 flex-shrink-0" />
          <span>Duplicate Flagged</span>
        </span>
      );

    case 'Archived':
    case 'Inactive':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-slate-100 text-slate-500 border-slate-300 line-through">
          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-slate-400" />
          Archived
        </span>
      );

    case 'Verified':
    case 'Active':
    case 'Clean':
    case 'Unique':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle className="h-3 w-3 mr-1 text-emerald-600 flex-shrink-0" />
          <span>Unique</span>
        </span>
      );

    default:
      break;
  }

  const label = (status || '').replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorStyles}`}
    >
      <span className={`w-1.5 h-1.5 mr-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}

export default StatusBadge;
