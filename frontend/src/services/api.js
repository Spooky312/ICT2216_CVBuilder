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
export const exportResume = (id) => api.get(`/resumes/${id}/export`, { responseType: 'blob' });

export const adminListUsers = (page = 1, perPage = 100) =>
  api.get(`/admin/users?page=${page}&per_page=${perPage}`);
export const adminLockUser = (id, minutes) => api.post(`/admin/users/${id}/lock`, { minutes });
export const adminUnlockUser = (id) => api.post(`/admin/users/${id}/unlock`);
export const adminGetAuditLog = (page = 1, perPage = 100) =>
  api.get(`/admin/audit-log?page=${page}&per_page=${perPage}`);
export const adminListTemplates = () => api.get('/admin/templates');
export const adminUpdateTemplate = (id, data) => api.put(`/admin/templates/${id}`, data);

export default api;
