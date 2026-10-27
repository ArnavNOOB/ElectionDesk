import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  UserCheck,
  UserPlus,
  ShieldAlert,
  KeyRound,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

export function UserManagementPage() {
  const { requestStepUp, user: currentUser } = useAuth();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    role: 'DATA_ENTRY_OPERATOR',
    password: '',
  });

  const [roleChangeTarget, setRoleChangeTarget] = useState(null);
  const [selectedNewRole, setSelectedNewRole] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: usersData, refetch } = useQuery({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await userApi.list();
      return res.data.data || [];
    },
  });

  const users = usersData || [];

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError('');
      await userApi.create(formData);
      setSuccess(`User ${formData.email} created successfully`);
      setCreateModalOpen(false);
      setFormData({ email: '', fullName: '', role: 'DATA_ENTRY_OPERATOR', password: '' });
      refetch();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChangeConfirm = async () => {
    if (!roleChangeTarget || !selectedNewRole) return;

    try {
      setIsSubmitting(true);
      setError('');
      // Step-up re-authentication required for role modification
      const stepUpToken = await requestStepUp();
      if (!stepUpToken) return;

      await userApi.updateRole(roleChangeTarget._id || roleChangeTarget.id, selectedNewRole, stepUpToken);
      setSuccess(`Updated role for ${roleChangeTarget.email} to ${selectedNewRole}`);
      setRoleChangeTarget(null);
      refetch();
    } catch (err) {
      if (err.message?.includes('cancelled')) return;
      setError(err.response?.data?.error?.message || 'Failed to update user role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (userObj) => {
    try {
      setError('');
      await userApi.toggleStatus(userObj._id || userObj.id, !userObj.isActive);
      setSuccess(`User ${userObj.email} is now ${!userObj.isActive ? 'Active' : 'Suspended'}`);
      refetch();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Action failed');
    }
  };

  const handleResetMfa = async (userObj) => {
    if (!window.confirm(`Reset MFA for ${userObj.email}? They will be prompted to re-enroll on next login.`)) return;
    try {
      setError('');
      await userApi.resetMfa(userObj._id || userObj.id);
      setSuccess(`MFA reset for ${userObj.email}`);
      refetch();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to reset MFA');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">User & Role Access Control</h1>
          <p className="text-xs text-slate-500">
            Granular Role-Based Access Control (RBAC). Changes to administrative privileges require step-up authentication.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-500 min-h-[38px]"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add Authorized User</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 flex items-start space-x-2">
          <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 flex items-start space-x-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-4 text-left">User</th>
                <th className="py-2.5 px-4 text-left">Role Privilege</th>
                <th className="py-2.5 px-4 text-left">MFA Status</th>
                <th className="py-2.5 px-4 text-left">Account Status</th>
                <th className="py-2.5 px-4 text-left">Last Login</th>
                <th className="py-2.5 px-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.map((u) => {
                const id = u._id || u.id;
                const isSelf = String(currentUser?._id || currentUser?.id) === String(id);
                return (
                  <tr key={id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{u.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      {u.mfaEnabled ? (
                        <span className="text-emerald-700 font-medium flex items-center">
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Enrolled (TOTP)
                        </span>
                      ) : (
                        <span className="text-slate-400">Not Enrolled</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Change Role Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setRoleChangeTarget(u);
                            setSelectedNewRole(u.role);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px]"
                        >
                          Change Role
                        </button>

                        {/* Reset MFA */}
                        {u.mfaEnabled && (
                          <button
                            type="button"
                            onClick={() => handleResetMfa(u)}
                            title="Reset MFA"
                            className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Suspend / Activate */}
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className={`px-2 py-1 rounded text-[11px] font-medium ${
                              u.isActive
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {u.isActive ? 'Suspend' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Add Authorized Personnel Account
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Anand Mahindra"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Official Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@electiondesk.gov"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Role Privilege Level</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
                >
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Full Administrative Rights)</option>
                  <option value="DATA_ADMIN">DATA_ADMIN (Voter Records & Datasets)</option>
                  <option value="DATA_ENTRY_OPERATOR">DATA_ENTRY_OPERATOR (Add & Edit Records)</option>
                  <option value="AUDITOR">AUDITOR (Oversight & Compliance Read)</option>
                  <option value="READ_ONLY">READ_ONLY (Redacted Observer)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Initial Strong Password</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 10 chars, uppercase, lowercase, numbers"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white font-semibold hover:bg-brand-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {roleChangeTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Modify Privilege Level for {roleChangeTarget.email}
            </h3>

            <p className="text-xs text-slate-600">
              Elevating or changing a user's role requires step-up authentication. When confirmed, all active sessions for this user will be revoked.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select New Role</label>
              <select
                value={selectedNewRole}
                onChange={(e) => setSelectedNewRole(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-brand-600 focus:outline-none"
              >
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                <option value="DATA_ADMIN">DATA_ADMIN</option>
                <option value="DATA_ENTRY_OPERATOR">DATA_ENTRY_OPERATOR</option>
                <option value="AUDITOR">AUDITOR</option>
                <option value="READ_ONLY">READ_ONLY</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRoleChangeTarget(null)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRoleChangeConfirm}
                disabled={isSubmitting || selectedNewRole === roleChangeTarget.role}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 disabled:opacity-50"
              >
                {isSubmitting ? 'Authorizing...' : 'Authorize Privilege Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagementPage;
