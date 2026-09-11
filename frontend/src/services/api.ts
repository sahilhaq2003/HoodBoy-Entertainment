import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hbe_token') || sessionStorage.getItem('hbe_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 403 is a permission decision and must never destroy a valid session.
    // Credential-validation endpoints also use 401 for expected input errors;
    // only an authenticated resource 401 means the stored session has expired.
    const requestUrl = String(error.config?.url || '');
    const credentialEndpoint = [
      '/auth/login', '/auth/login/2fa', '/auth/password', '/auth/2fa/disable',
      '/auth/reset-password', '/auth/forgot-password',
    ].some(path => requestUrl === path);
    if (error.response?.status === 401 && !credentialEndpoint) {
      localStorage.removeItem('hbe_token');
      localStorage.removeItem('hbe_user');
      ['hbe_token', 'hbe_user', 'hbe_access', 'hbe_role_description', 'hbe_dashboard_path', 'hbe_nav'].forEach(key => sessionStorage.removeItem(key));
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  verifyTwoFactor: (challengeToken: string, code: string) => api.post('/auth/login/2fa', { challengeToken, code }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) => api.post('/auth/reset-password', { token, newPassword }),
  me: () => api.get('/auth/me'),
  setupTwoFactor: () => api.post('/auth/2fa/setup'),
  confirmTwoFactor: (code: string) => api.post('/auth/2fa/confirm', { code }),
  disableTwoFactor: (password: string) => api.post('/auth/2fa/disable', { password }),
};

export const searchApi = {
  search: (q: string) => api.get('/search', { params: { q } }),
};

// Dashboard
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getFinancials: (year?: number) => api.get('/dashboard/financials', { params: { year } }),
  getProjectBreakdown: () => api.get('/dashboard/projects'),
  getDeadlines: () => api.get('/dashboard/deadlines'),
  getUnified: () => api.get('/dashboard/unified'),
  getRoleDashboard: () => api.get('/dashboard/role'),
  getMyProfile: () => api.get('/dashboard/profile'),
  updateMyProfile: (data: object) => api.put('/dashboard/profile', data),
  uploadMyImage: (formData: FormData) =>
    api.post('/dashboard/profile/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Artists
export const artistsApi = {
  getAll: (params?: object) => api.get('/artists', { params }),
  getById: (id: string) => api.get(`/artists/${id}`),
  create: (data: object) => api.post('/artists', data),
  update: (id: string, data: object) => api.put(`/artists/${id}`, data),
  delete: (id: string) => api.delete(`/artists/${id}`),
  // Onboarding
  updateOnboardingStep: (id: string, step: number, data: object) =>
    api.put(`/artists/${id}/onboarding-step`, { step, data }),
  submitForApproval: (id: string, onboardingPackageAcknowledged: boolean, notes?: string) =>
    api.put(`/artists/${id}/submit-for-approval`, { onboardingPackageAcknowledged, notes }),
  approve: (id: string, notes?: string) =>
    api.put(`/artists/${id}/approve`, { notes }),
  reject: (id: string, notes?: string) =>
    api.put(`/artists/${id}/reject`, { notes }),
  getOnboardingStats: () =>
    api.get('/artists/onboarding/stats'),
  // Document uploads
  uploadDocument: (id: string, formData: FormData) =>
    api.post(`/artists/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  removeDocument: (id: string, docId: string) =>
    api.delete(`/artists/${id}/documents/${docId}`),
  // Image uploads
  uploadImage: (id: string, formData: FormData) =>
    api.post(`/artists/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Projects
export const projectsApi = {
  getAll: (params?: object) => api.get('/projects', { params }),
  create: (data: object) => api.post('/projects', data),
  update: (id: string, data: object) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
};

// Tasks
export const tasksApi = {
  getAll: (params?: object) => api.get('/tasks', { params }),
  getById: (id: string) => api.get(`/tasks/${id}`),
  create: (data: object) => api.post('/tasks', data),
  update: (id: string, data: object) => api.put(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  getKanban: () => api.get('/tasks/kanban'),
  getTeam: () => api.get('/tasks/team'),
  getStats: () => api.get('/tasks/stats'),
  getAssignable: () => api.get('/tasks/assignable'),
  addComment: (id: string, message: string) => api.post(`/tasks/${id}/comments`, { message }),
};

// Weekly Reports
export const weeklyReportsApi = {
  getAll: () => api.get('/weekly-reports'),
  getById: (id: string) => api.get(`/weekly-reports/${id}`),
  create: (data: object) => api.post('/weekly-reports', data),
  update: (id: string, data: object) => api.put(`/weekly-reports/${id}`, data),
  delete: (id: string) => api.delete(`/weekly-reports/${id}`),
  getCurrentWeek: () => api.get('/weekly-reports/current'),
};

// Finances
export const financeApi = {
  getAll: (params?: object) => api.get('/finances', { params }),
  getSummary: (year?: number) => api.get('/finances/summary', { params: { year } }),
  create: (data: object) => api.post('/finances', data),
  update: (id: string, data: object) => api.put(`/finances/${id}`, data),
  delete: (id: string) => api.delete(`/finances/${id}`),
  getCashFlow: (year?: number) => api.get('/finances/cashflow', { params: { year } }),
  getCategoryBreakdown: (year?: number) => api.get('/finances/category-breakdown', { params: { year } }),
};

// Budgets
export const budgetsApi = {
  getAll: (params?: object) => api.get('/budgets', { params }),
  getById: (id: string) => api.get(`/budgets/${id}`),
  create: (data: object) => api.post('/budgets', data),
  update: (id: string, data: object) => api.put(`/budgets/${id}`, data),
  delete: (id: string) => api.delete(`/budgets/${id}`),
  addItem: (id: string, data: object) => api.post(`/budgets/${id}/items`, data),
  updateItem: (id: string, itemId: string, data: object) => api.put(`/budgets/${id}/items/${itemId}`, data),
  deleteItem: (id: string, itemId: string) => api.delete(`/budgets/${id}/items/${itemId}`),
  getActual: (id: string) => api.get(`/budgets/${id}/actual`),
  getStats: () => api.get('/budgets/stats'),
};

// Releases
export const releasesApi = {
  getAll: (params?: object) => api.get('/releases', { params }),
  getById: (id: string) => api.get(`/releases/${id}`),
  create: (data: object) => api.post('/releases', data),
  update: (id: string, data: object) => api.put(`/releases/${id}`, data),
  delete: (id: string) => api.delete(`/releases/${id}`),
  advancePhase: (id: string, force?: boolean) => api.put(`/releases/${id}/advance-phase`, { force }),
  updateChecklistItem: (id: string, phase: string, itemId: string, data: object) =>
    api.put(`/releases/${id}/phases/${phase}/checklist/${itemId}`, data),
  getDashboard: () => api.get('/releases/dashboard'),
};

// Contracts
export const contractsApi = {
  getAll: (params?: object) => api.get('/contracts', { params }),
  getById: (id: string) => api.get(`/contracts/${id}`),
  create: (data: object) => api.post('/contracts', data),
  update: (id: string, data: object) => api.put(`/contracts/${id}`, data),
  delete: (id: string) => api.delete(`/contracts/${id}`),
  getExpiring: (days?: number) => api.get('/contracts/expiring', { params: { days } }),
  getStats: () => api.get('/contracts/stats'),
};

// Ownership
export const ownershipApi = {
  getAll: (params?: object) => api.get('/ownership', { params }),
  getBySong: (songId: string) => api.get(`/ownership/song/${songId}`),
  createOrUpdate: (data: object) => api.post('/ownership', data),
  validate: (songId: string) => api.get(`/ownership/validate/${songId}`),
  approve: (songId: string) => api.post(`/ownership/approve/${songId}`),
  delete: (songId: string) => api.delete(`/ownership/song/${songId}`),
  getDashboard: () => api.get('/ownership/dashboard'),
};

// Campaigns
export const campaignsApi = {
  getAll: (params?: object) => api.get('/campaigns', { params }),
  getById: (id: string) => api.get(`/campaigns/${id}`),
  create: (data: object) => api.post('/campaigns', data),
  update: (id: string, data: object) => api.put(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  getStats: () => api.get('/campaigns/stats'),
  getCalendar: (params?: object) => api.get('/campaigns/calendar', { params }),
  addContentItem: (id: string, data: object) => api.post(`/campaigns/${id}/content`, data),
  updateContentItem: (id: string, contentId: string, data: object) => api.put(`/campaigns/${id}/content/${contentId}`, data),
  deleteContentItem: (id: string, contentId: string) => api.delete(`/campaigns/${id}/content/${contentId}`),
  getPerformance: (id: string) => api.get(`/campaigns/${id}/performance`),
};

// Contacts
export const contactsApi = {
  getAll: (params?: object) => api.get('/contacts', { params }),
  getById: (id: string) => api.get(`/contacts/${id}`),
  create: (data: object) => api.post('/contacts', data),
  update: (id: string, data: object) => api.put(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  toggleFavorite: (id: string) => api.patch(`/contacts/${id}/favorite`),
  addInteraction: (id: string, data: object) => api.post(`/contacts/${id}/interactions`, data),
  deleteInteraction: (id: string, interactionId: string) => api.delete(`/contacts/${id}/interactions/${interactionId}`),
  addReminder: (id: string, data: object) => api.post(`/contacts/${id}/reminders`, data),
  completeReminder: (id: string, reminderId: string) => api.put(`/contacts/${id}/reminders/${reminderId}`),
  deleteReminder: (id: string, reminderId: string) => api.delete(`/contacts/${id}/reminders/${reminderId}`),
  getUpcomingReminders: (params?: object) => api.get('/contacts/reminders', { params }),
  getStats: () => api.get('/contacts/stats'),
};

// Analytics
export const analyticsApi = {
  getOverview: () => api.get('/analytics/overview'),
  getRevenue: (year?: number) => api.get('/analytics/revenue', { params: { year } }),
  getArtists: () => api.get('/analytics/artists'),
  getReleases: () => api.get('/analytics/releases'),
  getOperational: () => api.get('/analytics/operational'),
  getKPIs: () => api.get('/analytics/kpis'),
  // System 14: Enhanced analytics
  getExecutive: () => api.get('/analytics/executive'),
  getArtistPerformance: (params?: object) => api.get('/analytics/artist-performance', { params }),
  getReleasePerformance: (params?: object) => api.get('/analytics/release-performance', { params }),
  getFinancial: (year?: number) => api.get('/analytics/financial', { params: { year } }),
  getMarketing: (params?: object) => api.get('/analytics/marketing', { params }),
  exportReport: (params: object) => api.get('/analytics/export', { params, responseType: 'text' as any }),
};

// Notifications
export const notificationsApi = {
  getAll: (params?: object) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
  generate: () => api.post('/notifications/generate'),
};

// Development
export const developmentApi = {
  getDashboard: () => api.get('/development/dashboard'),
  getAll: (params?: object) => api.get('/development', { params }),
  getById: (id: string) => api.get(`/development/${id}`),
  create: (data: object) => api.post('/development', data),
  update: (id: string, data: object) => api.put(`/development/${id}`, data),
  delete: (id: string) => api.delete(`/development/${id}`),
  addScorecard: (id: string, data: object) => api.post(`/development/${id}/scorecards`, data),
  updateScorecard: (id: string, scorecardId: string, data: object) =>
    api.put(`/development/${id}/scorecards/${scorecardId}`, data),
  getArtistProgress: (artistId: string) => api.get(`/development/artist/${artistId}`),
};

// File Manager
export const fileManagerApi = {
  initialize: () => api.post('/files/initialize'),
  getRoot: () => api.get('/files/root'),
  getFolder: (folderId: string) => api.get(`/files/folder/${folderId}`),
  createFolder: (data: { name: string; parentId?: string }) => api.post('/files/folders', data),
  createArtistStructure: (data: { artistName: string; artistId?: string }) =>
    api.post('/files/folders/artist-structure', data),
  createSongStructure: (data: { songName: string; parentFolderId?: string }) =>
    api.post('/files/folders/song-structure', data),
  renameFolder: (id: string, name: string) => api.put(`/files/folders/${id}`, { name }),
  deleteFolder: (id: string) => api.delete(`/files/folders/${id}`),
  upload: (formData: FormData) => api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadMultiple: (formData: FormData) => api.post('/files/upload-multiple', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getFiles: (params?: object) => api.get('/files/files', { params }),
  getFile: (id: string) => api.get(`/files/files/${id}`),
  getContent: (id: string, download = false) => api.get(`/files/files/${id}/content`, {
    params: download ? { download: 'true' } : undefined,
    responseType: 'blob',
  }),
  updateFile: (id: string, data: object) => api.put(`/files/files/${id}`, data),
  toggleStar: (id: string) => api.patch(`/files/files/${id}/star`),
  moveFile: (id: string, folderId: string) => api.put(`/files/files/${id}/move`, { folderId }),
  deleteFile: (id: string) => api.delete(`/files/files/${id}`),
  backupFile: (id: string, target: string) => api.post(`/files/files/${id}/backup`, { target }),
  search: (q: string) => api.get('/files/search', { params: { q } }),
  getStats: () => api.get('/files/stats'),
};

// Songs - extended
export const songsApi = {
  getAll: (params?: object) => api.get('/songs', { params }),
  getById: (id: string) => api.get(`/songs/${id}`),
  create: (data: object) => api.post('/songs', data),
  update: (id: string, data: object) => api.put(`/songs/${id}`, data),
  delete: (id: string) => api.delete(`/songs/${id}`),
  updateWorkflowStep: (songId: string, stepId: string, data: object) =>
    api.put(`/songs/${songId}/workflow/${stepId}`, data),
  getWorkflowStats: (songId: string) => api.get(`/songs/${songId}/workflow/stats`),
  addVersion: (songId: string, data: FormData) => api.post(`/songs/${songId}/versions`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateVersion: (songId: string, versionId: string, data: object) =>
    api.put(`/songs/${songId}/versions/${versionId}`, data),
  deleteVersion: (songId: string, versionId: string) =>
    api.delete(`/songs/${songId}/versions/${versionId}`),
};

// Royalties
export const royaltiesApi = {
  getAll: (params?: object) => api.get('/royalties', { params }),
  getArtistSummary: (artistId: string) => api.get(`/royalties/summary/${artistId}`),
  create: (data: object) => api.post('/royalties', data),
  calculate: (id: string) => api.post(`/royalties/${id}/calculate`),
  update: (id: string, data: object) => api.put(`/royalties/${id}`, data),
  delete: (id: string) => api.delete(`/royalties/${id}`),
  generateStatement: (id: string) => api.post(`/royalties/${id}/statement`),
  approve: (id: string) => api.post(`/royalties/${id}/approve`),
  recordPayment: (id: string, data: object) => api.post(`/royalties/${id}/payments`, data),
};

// Contract Templates
export const contractTemplatesApi = {
  getAll: (params?: object) => api.get('/contract-templates', { params }),
  getById: (id: string) => api.get(`/contract-templates/${id}`),
  create: (data: object) => api.post('/contract-templates', data),
  update: (id: string, data: object) => api.put(`/contract-templates/${id}`, data),
  delete: (id: string) => api.delete(`/contract-templates/${id}`),
};

// Per-Song Analytics
export const perSongAnalyticsApi = {
  getAll: (params?: object) => api.get('/per-song-analytics', { params }),
  getById: (id: string) => api.get(`/per-song-analytics/${id}`),
  getBySong: (songId: string) => api.get(`/per-song-analytics/song/${songId}`),
  create: (data: object) => api.post('/per-song-analytics', data),
  update: (id: string, data: object) => api.put(`/per-song-analytics/${id}`, data),
  delete: (id: string) => api.delete(`/per-song-analytics/${id}`),
};

// Lnk Up (The Lnk Up TV Show)
export const lnkUpApi = {
  getAll: (params?: object) => api.get('/lnk-up', { params }),
  getById: (id: string) => api.get(`/lnk-up/${id}`),
  getStats: () => api.get('/lnk-up/stats'),
  create: (data: object) => api.post('/lnk-up', data),
  update: (id: string, data: object) => api.put(`/lnk-up/${id}`, data),
  delete: (id: string) => api.delete(`/lnk-up/${id}`),
};

// Artist Balances
export const artistBalancesApi = {
  getAll: (params?: object) => api.get('/artist-balances', { params }),
  getById: (id: string) => api.get(`/artist-balances/${id}`),
  getByArtist: (artistId: string) => api.get(`/artist-balances/artist/${artistId}`),
  create: (data: object) => api.post('/artist-balances', data),
  update: (id: string, data: object) => api.put(`/artist-balances/${id}`, data),
  delete: (id: string) => api.delete(`/artist-balances/${id}`),
  addTransaction: (id: string, data: object) => api.post(`/artist-balances/${id}/transactions`, data),
  getHistory: (artistId: string) => api.get(`/artist-balances/artist/${artistId}/history`),
};

// Tax Calendar
export const taxCalendarApi = {
  getAll: (params?: object) => api.get('/tax-calendar', { params }),
  getById: (id: string) => api.get(`/tax-calendar/${id}`),
  create: (data: object) => api.post('/tax-calendar', data),
  update: (id: string, data: object) => api.put(`/tax-calendar/${id}`, data),
  delete: (id: string) => api.delete(`/tax-calendar/${id}`),
  getUpcoming: (days?: number) => api.get('/tax-calendar/upcoming', { params: { days } }),
};

// Activity
export const activityApi = {
  getAll: (params?: object) => api.get('/activity', { params }),
  getRecent: (limit?: number) => api.get('/activity/recent', { params: { limit } }),
};

// Settings
export const settingsApi = {
  updateProfile: (data: object) => api.put('/auth/profile', data),
  changePassword: (data: object) => api.put('/auth/password', data),
};

// Users (Admin)
export const usersApi = {
  getAll: (params?: object) => api.get('/users', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: object) => api.post('/users', data),
  update: (id: string, data: object) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  toggleActive: (id: string) => api.put(`/users/${id}/toggle-active`),
  resetPassword: (id: string, data: object) => api.put(`/users/${id}/reset-password`, data),
  getStats: () => api.get('/users/stats'),
  getPermissions: () => api.get('/users/permissions'),
};

export default api;
