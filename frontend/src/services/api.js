import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach CSRF token to mutating requests
api.interceptors.request.use((config) => {
  if (['post', 'put', 'delete', 'patch'].includes(config.method)) {
    const csrf = document.cookie
      .split('; ')
      .find((r) => r.startsWith('csrf_access_token='))
      ?.split('=')[1];
    if (csrf) config.headers['X-CSRF-TOKEN'] = csrf;
  }
  return config;
});

// Added /api prefix to all backend routes
export const register = (data) => api.post('/api/auth/register', data);
export const login = (data) => api.post('/api/auth/login', data);
export const verifyTwoFactor = (data) => api.post('/api/auth/verify-2fa', data);
export const logout = () => api.post('/api/auth/logout');

export const getProfile = () => api.get('/api/profile');
export const updateProfile = (data) => api.put('/api/profile', data);
export const deleteAccount = (data) => api.delete('/api/profile', { data });

export const getResumeLimits = () => api.get('/api/resumes/limits');
export const listResumes = () => api.get('/api/resumes');
export const getResume = (id) => api.get(`/api/resumes/${id}`);
export const createResume = (data) => api.post('/api/resumes', data);
export const updateResume = (id, data) => api.put(`/api/resumes/${id}`, data);
export const deleteResume = (id) => api.delete(`/api/resumes/${id}`);
export const duplicateResume = (id) => api.post(`/api/resumes/${id}/duplicate`);
export const previewResume = (data) => api.post('/api/resumes/preview', data, { responseType: 'blob' });
export const exportResume = (id) => api.get(`/api/resumes/${id}/export`, { responseType: 'blob' });

export const adminListUsers = (page = 1, perPage = 100) =>
  api.get(`/api/admin/users?page=${page}&per_page=${perPage}`);
export const adminLockUser = (id, minutes) => api.post(`/api/admin/users/${id}/lock`, { minutes });
export const adminUnlockUser = (id) => api.post(`/api/admin/users/${id}/unlock`);
export const adminDeactivateUser = (id) => api.post(`/api/admin/users/${id}/deactivate`);
export const adminDeleteUser = (id) => api.delete(`/api/admin/users/${id}`);
export const adminGetAuditLog = (page = 1, perPage = 100, filters = {}) => {
  const params = { page, per_page: perPage, ...filters };
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return api.get(`/api/admin/audit-log?${query}`);
};
export const adminListTemplates = () => api.get('/api/admin/templates');
export const adminCreateTemplate = (data) => api.post('/api/admin/templates', data);
export const adminUploadTemplate = (data) => api.post('/api/admin/templates/upload', data, {
  // This explicitly deletes the default JSON header just for this one request,
  // allowing the browser to safely attach the file and generate the boundary string!
  transformRequest: [(data, headers) => {
    delete headers['Content-Type'];
    return data;
  }]
});
export const adminUpdateTemplate = (id, data) => api.put(`/api/admin/templates/${id}`, data);
export const adminDeleteTemplate = (id) => api.delete(`/api/admin/templates/${id}`);

export const getTemplates = () => api.get('/api/resumes/templates');

export default api;


