import React from 'react';
import { Home, Users, User } from 'lucide-react';

export function FamilyBadge({ role, familyHead, showHeadName = false }) {
  const normRole = (role || 'SM').toUpperCase();

  if (normRole === 'FH') {
    return (
      <span
        title="Family Head (FH)"
        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
      >
        <Home className="h-3 w-3 mr-1 text-indigo-500" />
        <span>FH</span>
        <span className="hidden sm:inline ml-1 text-[10px] text-indigo-600 font-normal">(Head)</span>
      </span>
    );
  }

  if (normRole === 'FM') {
    return (
      <div className="inline-flex flex-col items-start">
        <span
          title={
            familyHead
              ? `Family Member of ${familyHead.fullName || ''} (Booth Sl #${familyHead.boothSerialNumber || '—'})`
              : 'Family Member (FM)'
          }
          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200"
        >
          <Users className="h-3 w-3 mr-1 text-purple-500" />
          <span>FM</span>
          <span className="hidden sm:inline ml-1 text-[10px] text-purple-600 font-normal">(Member)</span>
        </span>
        {showHeadName && familyHead && (
          <span className="text-[10px] text-purple-800 font-medium mt-0.5 truncate max-w-[140px]">
            Head: #{familyHead.boothSerialNumber} {familyHead.fullName?.split(' ')[0]}
          </span>
        )}
      </div>
    );
  }

  // SM - Single Member
  return (
    <span
      title="Single Member (SM)"
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200"
    >
      <User className="h-3 w-3 mr-1 text-slate-400" />
      <span>SM</span>
      <span className="hidden sm:inline ml-1 text-[10px] text-slate-500">(Single)</span>
    </span>
  );
}

export default FamilyBadge;
