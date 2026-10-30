import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL;
let calculatedBaseUrl = '/api/v1';

if (rawApiUrl && typeof rawApiUrl === 'string') {
  // Normalize: strip trailing slashes
  const trimmed = rawApiUrl.trim().replace(/\/+$/, '');
  // Auto-append /api/v1 if the user provided root domain (e.g. https://service.onrender.com)
  calculatedBaseUrl = trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
} else if (
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
) {
  calculatedBaseUrl = 'http://localhost:5001/api/v1';
}

export const API_BASE_URL = calculatedBaseUrl;

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set or clear the authorization token
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('electiondesk_token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('electiondesk_token');
  }
}

// Initialize token from storage if present
const storedToken = localStorage.getItem('electiondesk_token');
if (storedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}

// Request interceptor to attach step-up token if set in session
api.interceptors.request.use((config) => {
  const stepUpToken = sessionStorage.getItem('electiondesk_step_up_token');
  if (stepUpToken && !config.headers['x-step-up-token']) {
    config.headers['x-step-up-token'] = stepUpToken;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      setAuthToken(null);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  verifyMfa: (data) => api.post('/auth/mfa/verify', data),
  setupMfa: () => api.post('/auth/mfa/setup'),
  stepUp: (password) => api.post('/auth/step-up', { password }),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const voterApi = {
  list: (params) => api.get('/voters', { params }),
  getById: (id) => api.get(`/voters/${id}`),
  create: (data) => api.post('/voters', data),
  update: (id, data) => api.put(`/voters/${id}`, data),
  archive: (id, reason) => api.post(`/voters/${id}/archive`, { reason }),
  restore: (id) => api.post(`/voters/${id}/restore`),
  getFamilyHeads: (params) => api.get('/voters/family-heads', { params }),
  checkDuplicates: (data, excludeId) => api.post(`/voters/check-duplicates`, data, { params: { excludeId } }),
  uploadPhoto: (voterId, formData) =>
    api.post(`/voters/${voterId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getPhotoUrl: (voterId) => `${API_BASE_URL}/voters/${voterId}/photo`,
  deletePhoto: (voterId) => api.delete(`/voters/${voterId}/photo`),
};

export const boothApi = {
  list: (params) => api.get('/polling-stations', { params }),
  getById: (id) => api.get(`/polling-stations/${id}`),
  create: (data) => api.post('/polling-stations', data),
  update: (id, data) => api.put(`/polling-stations/${id}`, data),
  summary: () => api.get('/polling-stations/summary'),
};

export const importExportApi = {
  downloadTemplate: () => api.get('/import-export/template', { responseType: 'blob' }),
  previewImport: (formData) =>
    api.post('/import-export/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  commitImport: (rows, options = {}) => api.post('/import-export/commit', { rows, skipDuplicates: Boolean(options?.skipDuplicates) }),
  exportVoters: (params, stepUpToken) =>
    api.get('/import-export/voters', {
      params,
      responseType: 'blob',
      headers: stepUpToken ? { 'x-step-up-token': stepUpToken } : {},
    }),
};

export const auditApi = {
  list: (params) => api.get('/audit-logs', { params }),
  verifyChain: () => api.get('/audit-logs/verify-chain'),
};

export const userApi = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  updateRole: (id, role, stepUpToken) =>
    api.put(`/users/${id}/role`, { role }, { headers: { 'x-step-up-token': stepUpToken } }),
  toggleStatus: (id, isActive) => api.patch(`/users/${id}/status`, { isActive }),
  resetMfa: (id) => api.post(`/users/${id}/reset-mfa`),
};

export const reportApi = {
  getDashboard: () => api.get('/reports/dashboard'),
};

export const placesApi = {
  autocomplete: (input) => api.get('/places/autocomplete', { params: { input } }),
  getDetails: (placeId) => api.get(`/places/details/${placeId}`),
  getPatialaLocalities: () => api.get('/places/patiala/localities'),
  searchPatiala: (params) => api.get('/places/patiala/search', { params }),
  geocode: (address) => api.get('/places/geocode', { params: { address } }),
  reverseGeocode: (lat, lng) => api.get('/places/reverse-geocode', { params: { lat, lng } }),
};

export const governanceApi = {
  getPolicy: () => api.get('/governance'),
  updatePolicy: (data, stepUpToken) =>
    api.put('/governance', data, { headers: { 'x-step-up-token': stepUpToken } }),
  runPurge: (stepUpToken) =>
    api.post('/governance/purge', {}, { headers: { 'x-step-up-token': stepUpToken } }),
  clearSeedData: (options, stepUpToken) =>
    api.post('/governance/clear-seed-data', options || {}, { headers: { 'x-step-up-token': stepUpToken } }),
};

export const securityApi = {
  getHealth: () => api.get('/security/health'),
  resolveEvent: (id) => api.patch(`/security/events/${id}/resolve`),
};

export const communicationApi = {
  initiateCall: (data) => api.post('/communications/calls', data),
  getCallStatus: (id) => api.get(`/communications/calls/${id}`),
  sendWhatsAppMessage: (data) => api.post('/communications/whatsapp/messages', data),
  getHistory: (recordId, params) => api.get(`/communications/history/${recordId}`, { params }),
  getTemplates: () => api.get('/communications/templates'),
  updateConsent: (recordId, data) => api.post(`/communications/consent/${recordId}`, data),
};
