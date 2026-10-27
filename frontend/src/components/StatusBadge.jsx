import React from 'react';

export function StatusBadge({ status }) {
  let colorStyles = 'bg-slate-100 text-slate-700 border-slate-200';

  switch (status) {
    case 'Verified':
    case 'Active':
      colorStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      break;
    case 'Pending_Verification':
    case 'Under_Review':
      colorStyles = 'bg-amber-50 text-amber-700 border-amber-200';
      break;
    case 'Flagged_Duplicate':
    case 'Disputed':
      colorStyles = 'bg-rose-50 text-rose-700 border-rose-200';
      break;
    case 'Archived':
    case 'Inactive':
      colorStyles = 'bg-slate-100 text-slate-500 border-slate-300 line-through';
      break;
    default:
      break;
  }

  const label = (status || '').replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorStyles}`}
    >
      <span
        className={`w-1.5 h-1.5 mr-1.5 rounded-full ${
          status === 'Verified' || status === 'Active'
            ? 'bg-emerald-500'
            : status === 'Pending_Verification' || status === 'Under_Review'
            ? 'bg-amber-500'
            : status === 'Flagged_Duplicate' || status === 'Disputed'
            ? 'bg-rose-500'
            : 'bg-slate-400'
        }`}
      />
      {label}
    </span>
  );
}

export default StatusBadge;
