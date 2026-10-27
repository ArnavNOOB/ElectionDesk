import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { NavLink } from 'react-router-dom';
import {
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  MapPin,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  FileCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export function DashboardPage() {
  const { user, canCreateVoter, canImport, canExport } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const res = await reportApi.getDashboard();
      return res.data.data;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Calculating authorized operational metrics...</p>
        </div>
      </div>
    );
  }

  const metrics = data || {};

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-brand-900 to-slate-900 p-6 text-white shadow-lg border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 mb-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Election Commission Secure Administrative Node</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Welcome back, {user?.fullName || 'Administrator'}
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Centralized Voter Information Management System. Real-time statistics are calculated directly from authorized database records adhering to the Digital Personal Data Protection Act, 2023.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canCreateVoter && (
              <NavLink
                to="/voters/new"
                className="inline-flex items-center space-x-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm transition"
              >
                <span>+ Add Voter</span>
              </NavLink>
            )}
            {canImport && (
              <NavLink
                to="/import"
                className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg border border-slate-700 transition"
              >
                <span>Import Spreadsheet (.xlsx)</span>
              </NavLink>
            )}
            {canExport && (
              <NavLink
                to="/export"
                className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg border border-slate-700 transition"
              >
                <span>Export Roll</span>
              </NavLink>
            )}
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Authorized Records */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Authorized Voters</span>
            <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{metrics.totalRecords || 0}</div>
            <p className="text-xs text-emerald-600 mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              <span>+{metrics.addedLast7Days || 0} added this week</span>
            </p>
          </div>
        </div>

        {/* Verified Records */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Verified Records</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{metrics.verifiedCount || 0}</div>
            <p className="text-xs text-slate-500 mt-1">
              {metrics.totalRecords
                ? `${Math.round(((metrics.verifiedCount || 0) / metrics.totalRecords) * 100)}% verification rate`
                : '100% verified'}
            </p>
          </div>
        </div>

        {/* Pending Verification */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Verification</span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{metrics.pendingVerification || 0}</div>
            <p className="text-xs text-amber-600 mt-1">Awaiting field officer review</p>
          </div>
        </div>

        {/* Potential Duplicates & Alerts */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Flagged Duplicates</span>
            <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600">{metrics.flaggedDuplicates || 0}</div>
            <NavLink to="/data-quality" className="text-xs text-brand-600 hover:underline mt-1 block">
              Review flagged matches →
            </NavLink>
          </div>
        </div>
      </div>

      {/* Secondary Demographic & Booth Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gender Demographics Card */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
            <Users className="h-4 w-4 text-brand-600 mr-2" />
            Gender Representation
          </h3>
          <div className="space-y-3">
            {Object.entries(metrics.genderDistribution || {}).map(([g, count]) => {
              const pct = metrics.totalRecords ? Math.round((count / metrics.totalRecords) * 100) : 0;
              return (
                <div key={g}>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span className="font-medium">{g}</span>
                    <span className="text-slate-500 font-mono">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        g === 'Male' ? 'bg-blue-500' : g === 'Female' ? 'bg-pink-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Age Brackets Distribution */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
            <TrendingUp className="h-4 w-4 text-emerald-600 mr-2" />
            Age Brackets
          </h3>
          <div className="space-y-3">
            {Object.entries(metrics.ageBrackets || {}).map(([bracket, count]) => {
              const pct = metrics.totalRecords ? Math.round((count / metrics.totalRecords) * 100) : 0;
              return (
                <div key={bracket}>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span className="font-medium">{bracket} yrs</span>
                    <span className="text-slate-500 font-mono">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Quality & Polling Booth Quick Summary */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
              <MapPin className="h-4 w-4 text-brand-600 mr-2" />
              Electoral Infrastructure
            </h3>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-medium">Total Polling Booths</span>
                <span className="font-semibold text-slate-900 font-mono">{metrics.totalBooths || 0}</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-medium">Unassigned Booth Records</span>
                <span className="font-semibold text-amber-600 font-mono">
                  {metrics.qualityIssues?.unassignedBooth || 0}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-medium">Unverified Residential Addresses</span>
                <span className="font-semibold text-amber-600 font-mono">
                  {metrics.qualityIssues?.unverifiedAddress || 0}
                </span>
              </div>
            </div>
          </div>

          <NavLink
            to="/booths"
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Manage Polling Booths <ArrowUpRight className="h-3 w-3 ml-1" />
          </NavLink>
        </div>
      </div>

      {/* Recent Administrative Activity Feed */}
      <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FileCheck className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-slate-900">Recent Cryptographic Audit Trail</h3>
          </div>
          <NavLink to="/audit-logs" className="text-xs text-brand-600 hover:underline font-medium">
            View full immutable audit log →
          </NavLink>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3 text-left">Timestamp (UTC)</th>
                <th className="py-2.5 px-3 text-left">Actor</th>
                <th className="py-2.5 px-3 text-left">Action</th>
                <th className="py-2.5 px-3 text-left">Target Entity</th>
                <th className="py-2.5 px-3 text-left">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {metrics.recentActivity && metrics.recentActivity.length > 0 ? (
                metrics.recentActivity.map((log) => (
                  <tr key={log._id || log.id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-900">{log.actorEmail}</td>
                    <td className="py-2 px-3 font-mono font-medium text-brand-700">{log.action}</td>
                    <td className="py-2 px-3 text-slate-500">{log.entityType}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                          log.outcome === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {log.outcome}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    No recent administrative activity recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
