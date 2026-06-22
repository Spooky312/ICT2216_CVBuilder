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

export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const verifyTwoFactor = (data) => api.post('/auth/verify-2fa', data);
export const logout = () => api.post('/auth/logout');

export const getProfile = () => api.get('/profile');
export const updateProfile = (data) => api.put('/profile', data);
export const deleteAccount = (data) => api.delete('/profile', { data });

export const getResumeLimits = () => api.get('/resumes/limits');
export const listResumes = () => api.get('/resumes');
export const getResume = (id) => api.get(`/resumes/${id}`);
export const createResume = (data) => api.post('/resumes', data);
export const updateResume = (id, data) => api.put(`/resumes/${id}`, data);
export const deleteResume = (id) => api.delete(`/resumes/${id}`);
export const duplicateResume = (id) => api.post(`/resumes/${id}/duplicate`);
export const previewResume = (data) => api.post('/resumes/preview', data, { responseType: 'blob' });
export const exportResume = (id) => api.get(`/resumes/${id}/export`, { responseType: 'blob' });

export const adminListUsers = (page = 1, perPage = 100) =>
  api.get(`/admin/users?page=${page}&per_page=${perPage}`);
export const adminLockUser = (id, minutes) => api.post(`/admin/users/${id}/lock`, { minutes });
export const adminUnlockUser = (id) => api.post(`/admin/users/${id}/unlock`);
export const adminDeactivateUser = (id) => api.post(`/admin/users/${id}/deactivate`);
export const adminDeleteUser = (id) => api.delete(`/admin/users/${id}`);
export const adminGetAuditLog = (page = 1, perPage = 100, filters = {}) => {
  const params = { page, per_page: perPage, ...filters };
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return api.get(`/admin/audit-log?${query}`);
};
export const adminListTemplates = () => api.get('/admin/templates');
export const adminCreateTemplate = (data) => api.post('/admin/templates', data);
export const adminUpdateTemplate = (id, data) => api.put(`/admin/templates/${id}`, data);

export default api;


