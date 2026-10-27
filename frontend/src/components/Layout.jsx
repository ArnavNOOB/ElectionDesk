import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { StepUpModal } from './StepUpModal';
import ErrorBoundary from './ErrorBoundary';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  MapPin,
  Upload,
  Download,
  AlertTriangle,
  FileText,
  UserCheck,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  Lock,
  ChevronDown,
} from 'lucide-react';

export function Layout() {
  const { user, logout, role, canCreateVoter, canImport, canExport, canManageUsers, canViewAudit, canViewSecurity } =
    useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, show: true },
    { label: 'Voter Directory', to: '/voters', icon: Users, show: true },
    { label: 'Add Voter Record', to: '/voters/new', icon: UserPlus, show: canCreateVoter },
    { label: 'Polling Booths', to: '/booths', icon: MapPin, show: true },
    { label: 'Import Wizard', to: '/import', icon: Upload, show: canImport },
    { label: 'Export Center', to: '/export', icon: Download, show: canExport },
    { label: 'Data Quality & Duplicates', to: '/data-quality', icon: AlertTriangle, show: canImport },
    { label: 'Audit Trail', to: '/audit-logs', icon: FileText, show: canViewAudit },
    { label: 'User & Roles', to: '/users', icon: UserCheck, show: canManageUsers },
    { label: 'Security & Health', to: '/security-health', icon: Shield, show: canViewSecurity },
    { label: 'Governance & DPDP', to: '/governance', icon: Settings, show: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <StepUpModal />

      {/* Mobile Sticky Header */}
      <div className="lg:hidden bg-slate-900 text-white px-3.5 py-2.5 flex items-center justify-between border-b border-slate-800 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white shadow text-sm">
            ED
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight block leading-none">ElectionDesk</span>
            <span className="text-[10px] text-brand-400 font-mono tracking-tight uppercase">
              {(role || '').replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-[11px] text-emerald-400 font-medium bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
            <Lock className="h-3 w-3" />
            <span>Secure</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-200"
        />
      )}

      {/* Sidebar for Desktop & Slide-over Drawer for Mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 transition-transform duration-300 ease-in-out transform lg:static lg:translate-x-0 lg:w-64 lg:z-30 overflow-y-auto ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Logo Brand Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white shadow-md text-base">
                ED
              </div>
              <div>
                <div className="font-bold text-white tracking-tight leading-none text-base">ElectionDesk</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 font-semibold">
                  Voter Info System
                </div>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems
              .filter((item) => item.show)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
          </nav>
        </div>

        {/* User Profile & Logout Bottom Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-brand-700/80 border border-brand-500/50 flex items-center justify-center text-white font-semibold text-xs shadow-inner flex-shrink-0">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate">{user?.fullName}</div>
              <div className="text-[11px] text-brand-400 font-mono tracking-tight capitalize truncate">
                {(role || '').replace(/_/g, ' ')}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-medium rounded-lg text-slate-400 bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 border border-slate-700/80 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Secure Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Header Bar */}
        <header className="hidden lg:flex items-center justify-between bg-white border-b border-slate-200 px-8 py-3.5 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              <Lock className="h-3 w-3 text-emerald-600" />
              <span>TLS 1.3 End-to-End Secure Session</span>
            </div>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-mono">DPDP Act 2023 Compliant</span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-medium">Logged in as</span>
              <span className="text-xs font-semibold text-slate-800">{user?.email}</span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide bg-brand-50 text-brand-700 border border-brand-200 uppercase">
              {role}
            </span>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <ErrorBoundary title="Section failed to load">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default Layout;
