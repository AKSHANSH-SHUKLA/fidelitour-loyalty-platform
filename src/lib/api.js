import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const adminAPI = {
  getTenants: () => api.get('/admin/tenants'),
  createTenant: (data) => api.post('/admin/tenants', data),
  updateTenant: (id, data) => api.put('/admin/tenants/' + id, data),
  deleteTenant: (id) => api.delete('/admin/tenants/' + id),
  getTenantDetails: (id) => api.get('/admin/tenants/' + id + '/details'),
  updateTenantGeo: (id, data) => api.put('/admin/tenants/' + id + '/geo', data),
  getAnalytics: () => api.get('/admin/analytics'),
  getDetailedAnalytics: () => api.get('/admin/detailed-analytics'),
  getEnhancedAnalytics: () => api.get('/admin/enhanced-analytics'),
  getTenantsByPlan: (plan) => api.get('/admin/tenants-by-plan/' + plan),
  getCardTemplate: (tenantId) => api.get('/admin/card-template/' + tenantId),
  saveCardTemplate: (tenantId, data) => api.post('/admin/card-template/' + tenantId, data),
  aiQuery: (data) => api.post('/admin/ai-query', data),
  sendBusinessCampaign: (data) => api.post('/admin/send-business-campaign', data),
};

export const ownerAPI = {
  getTenant: () => api.get('/owner/tenant'),
  updateTenant: (data) => api.put('/owner/tenant', data),
  getCustomers: () => api.get('/owner/customers'),
  getAnalytics: () => api.get('/owner/analytics'),
  scanVisit: (data) => api.post('/owner/scan', data),
  getCardTemplate: () => api.get('/owner/card-template'),
  saveCardTemplate: (data) => api.post('/owner/card-template', data),
  getCampaigns: () => api.get('/owner/campaigns'),
  createCampaign: (data) => api.post('/owner/campaigns', data),
  sendCampaign: (id) => api.post('/owner/campaigns/' + id + '/send'),
  previewSegment: (data) => api.post('/owner/campaigns/preview-segment', data),
  aiQuery: (data) => api.post('/owner/ai-query', data),
};

export const publicAPI = {
  getJoinInfo: (slug) => api.get('/join/' + slug),
  joinProgram: (slug, data) => api.post('/join/' + slug, data),
};

export default api;
