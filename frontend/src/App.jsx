import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import MfaVerifyPage from './pages/MfaVerifyPage';
import AccountRecoveryPage from './pages/AccountRecoveryPage';
import DashboardPage from './pages/DashboardPage';
import VoterDirectoryPage from './pages/VoterDirectoryPage';
import AddVoterPage from './pages/AddVoterPage';
import VoterDetailsPage from './pages/VoterDetailsPage';
import EditVoterPage from './pages/EditVoterPage';
import ImportWizardPage from './pages/ImportWizardPage';
import ExportCenterPage from './pages/ExportCenterPage';
import DataQualityPage from './pages/DataQualityPage';
import AuditLogsPage from './pages/AuditLogsPage';
import UserManagementPage from './pages/UserManagementPage';
import SecurityHealthPage from './pages/SecurityHealthPage';
import GovernancePage from './pages/GovernancePage';
import PollingBoothsPage from './pages/PollingBoothsPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import NotFoundPage from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      {/* Public Authentication Pages */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/mfa-verify" element={<MfaVerifyPage />} />
      <Route path="/account-recovery" element={<AccountRecoveryPage />} />

      {/* Protected Administrative Dashboard Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="voters" element={<VoterDirectoryPage />} />
        <Route
          path="voters/new"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DATA_ADMIN', 'DATA_ENTRY_OPERATOR']}>
              <AddVoterPage />
            </ProtectedRoute>
          }
        />
        <Route path="voters/:id" element={<VoterDetailsPage />} />
        <Route
          path="voters/:id/edit"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DATA_ADMIN', 'DATA_ENTRY_OPERATOR']}>
              <EditVoterPage />
            </ProtectedRoute>
          }
        />
        <Route path="booths" element={<PollingBoothsPage />} />
        <Route
          path="import"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DATA_ADMIN']}>
              <ImportWizardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="export"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DATA_ADMIN']}>
              <ExportCenterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="data-quality"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DATA_ADMIN']}>
              <DataQualityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit-logs"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'AUDITOR']}>
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="security-health"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <SecurityHealthPage />
            </ProtectedRoute>
          }
        />
        <Route path="governance" element={<GovernancePage />} />
      </Route>

      {/* Exception & Error Routes */}
      <Route path="/access-denied" element={<AccessDeniedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
