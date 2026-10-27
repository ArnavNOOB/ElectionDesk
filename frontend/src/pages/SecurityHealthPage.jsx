import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { securityApi } from '../api/client';
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Server,
  Database,
  Cpu,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export function SecurityHealthPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['security-health'],
    queryFn: async () => {
      const res = await securityApi.getHealth();
      return res.data.data;
    },
    refetchInterval: 15000,
  });

  const health = data || {};
  const activeAlerts = health.security?.activeAlerts || [];
  const resolvedAlerts = health.security?.resolvedAlerts || [];

  const handleResolve = async (alertId) => {
    try {
      await securityApi.resolveEvent(alertId);
      refetch();
    } catch (err) {
      alert('Failed to resolve alert');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Inspecting system security health...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Health & Security Events</h1>
          <p className="text-xs text-slate-500">
            Real-time infrastructure health metrics, rate limiter counters, and threat detection alerts.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* System Health Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Node.js Runtime Status */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Server Status</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-slate-900 flex items-center">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 mr-2" />
              {health.status || 'ONLINE'}
            </div>
            <p className="text-xs text-slate-500 mt-1">Uptime: {Math.floor((health.uptimeSeconds || 0) / 60)} mins</p>
          </div>
        </div>

        {/* Database Mode */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Database Engine</span>
            <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-slate-900 font-mono">
              {health.database?.mode === 'MONGODB_CLUSTER' ? 'MongoDB Atlas Cluster' : 'In-Memory Engine (Sandbox)'}
            </div>
            <p className="text-xs text-emerald-600 mt-1 flex items-center">
              <CheckCircle className="h-3 w-3 mr-1" />
              <span>Pool Active (TLS Encrypted)</span>
            </p>
          </div>
        </div>

        {/* Memory Footprint */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Memory Allocation</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-slate-900 font-mono">
              {health.memory?.heapUsedMb || 0} MB
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Heap Total: {health.memory?.heapTotalMb || 0} MB • RSS: {health.memory?.rssMb || 0} MB
            </p>
          </div>
        </div>

        {/* Security Alerts */}
        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Alerts</span>
            <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl font-bold text-rose-600">
              {health.security?.unresolvedAlertCount || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">Requiring administrative review</p>
          </div>
        </div>
      </div>

      {/* Security Threat Alerts Section */}
      <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
          <span className="flex items-center">
            <ShieldAlert className="h-4 w-4 text-rose-600 mr-2" />
            Active Security Incidents & Threat Events
          </span>
          <span className="text-xs font-normal text-slate-400">Automatic intrusion & lockout detection</span>
        </h2>

        {activeAlerts.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">All security systems nominal.</p>
            <p className="text-slate-400 mt-0.5">No active brute-force or unauthorized access anomalies detected.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeAlerts.map((evt) => {
              const id = evt._id || evt.id;
              return (
                <div
                  key={id}
                  className="rounded-lg border border-rose-200 bg-rose-50/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold font-mono text-rose-700">{evt.eventType}</span>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold text-[10px]">
                        {evt.severity}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        IP: {evt.sourceIp || '127.0.0.1'}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-1">
                      Details: {evt.details ? JSON.stringify(evt.details) : 'Security constraint triggered'}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Logged at: {new Date(evt.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleResolve(id)}
                    className="self-start sm:self-center px-3 py-1.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 font-semibold text-slate-700 shadow-sm text-xs whitespace-nowrap"
                  >
                    Mark Resolved
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SecurityHealthPage;
