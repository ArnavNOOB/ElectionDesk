import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setAuthToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('electiondesk_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [stepUpToken, setStepUpTokenState] = useState(() => sessionStorage.getItem('electiondesk_step_up_token'));

  // Step-up modal state
  const [isStepUpModalOpen, setIsStepUpModalOpen] = useState(false);
  const [stepUpResolveReject, setStepUpResolveReject] = useState(null);

  // Fetch current user on initial load
  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const res = await authApi.getMe();
          setUser(res.data.data);
        } catch (err) {
          setAuthToken(null);
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, [token]);

  // Login handler
  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    const data = res.data.data;

    if (data.mfaRequired) {
      setMfaChallenge({
        tempToken: data.tempToken,
        user: data.user,
      });
      return { mfaRequired: true };
    }

    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    setMfaChallenge(null);
    return { mfaRequired: false };
  };

  // MFA verify handler
  const verifyMfa = async (code) => {
    if (!mfaChallenge?.tempToken) {
      throw new Error('No pending MFA challenge found');
    }

    const res = await authApi.verifyMfa({
      tempToken: mfaChallenge.tempToken,
      tokenOrBackupCode: code,
    });
    const data = res.data.data;

    setAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    setMfaChallenge(null);
    return data;
  };

  // Logout handler
  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Ignore
    } finally {
      setAuthToken(null);
      setToken(null);
      setUser(null);
      setMfaChallenge(null);
      sessionStorage.removeItem('electiondesk_step_up_token');
      setStepUpTokenState(null);
    }
  };

  // Request Step-Up Authentication dialog
  const requestStepUp = useCallback(() => {
    return new Promise((resolve, reject) => {
      setIsStepUpModalOpen(true);
      setStepUpResolveReject({ resolve, reject });
    });
  }, []);

  const confirmStepUp = async (password) => {
    try {
      const res = await authApi.stepUp(password);
      const token = res.data.data.stepUpToken;
      sessionStorage.setItem('electiondesk_step_up_token', token);
      setStepUpTokenState(token);
      setIsStepUpModalOpen(false);
      if (stepUpResolveReject?.resolve) {
        stepUpResolveReject.resolve(token);
      }
      return token;
    } catch (err) {
      throw err;
    }
  };

  const cancelStepUp = () => {
    setIsStepUpModalOpen(false);
    if (stepUpResolveReject?.reject) {
      stepUpResolveReject.reject(new Error('Step-up authentication cancelled by user'));
    }
  };

  // Role helpers
  const role = user?.role || 'ANONYMOUS';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isDataAdmin = role === 'DATA_ADMIN';
  const isOperator = role === 'DATA_ENTRY_OPERATOR';
  const isAuditor = role === 'AUDITOR';
  const isReadOnly = role === 'READ_ONLY';

  const canCreateVoter = isSuperAdmin || isDataAdmin || isOperator;
  const canEditVoter = isSuperAdmin || isDataAdmin || isOperator;
  const canArchiveVoter = isSuperAdmin || isDataAdmin;
  const canImport = isSuperAdmin || isDataAdmin;
  const canExport = isSuperAdmin || isDataAdmin;
  const canManageUsers = isSuperAdmin;
  const canViewAudit = isSuperAdmin || isAuditor;
  const canManageBooths = isSuperAdmin || isDataAdmin;
  const canViewSecurity = isSuperAdmin;
  const canCommunicate = isSuperAdmin || isDataAdmin || isOperator;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        mfaChallenge,
        stepUpToken,
        login,
        verifyMfa,
        logout,
        requestStepUp,
        isStepUpModalOpen,
        confirmStepUp,
        cancelStepUp,
        role,
        isSuperAdmin,
        isDataAdmin,
        isOperator,
        isAuditor,
        isReadOnly,
        canCreateVoter,
        canEditVoter,
        canArchiveVoter,
        canImport,
        canExport,
        canManageUsers,
        canViewAudit,
        canManageBooths,
        canViewSecurity,
        canCommunicate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
