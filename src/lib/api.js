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
  getTenantCustomers: (tenantId) => api.get('/admin/tenants/' + tenantId + '/customers'),
  getTenantAnalytics: (tenantId, params) => api.get('/admin/tenants/' + tenantId + '/analytics', { params }),
  getTenantsByTier: (tier) => api.get('/admin/tenants-by-tier/' + tier),
  getTenantsByAcquisition: (source) => api.get('/admin/tenants-by-acquisition/' + source),
  getTenantsByGeo: (enabled) => api.get('/admin/tenants-by-geo/' + (enabled ? 'enabled' : 'disabled')),
  getTenantsByMonth: (iso) => api.get('/admin/tenants-by-month/' + iso),
  getInsights: () => api.get('/admin/insights'),
  // -- Broadcast (admin → end-customers) --
  broadcast: (data) => api.post('/admin/broadcast', data),
  broadcastPreview: (filters) => api.post('/admin/broadcast/preview', { filters }),
  listBroadcasts: () => api.get('/admin/broadcasts'),
  // -- Upgrade-plan requests inbox --
  listUpgradeRequests: () => api.get('/admin/upgrade-requests'),
  resolveUpgradeRequest: (id, status) => api.put('/admin/upgrade-requests/' + id, { status }),
  // -- Cron trigger (dev/manual) --
  triggerDailyTasks: (secret) =>
    api.post('/cron/daily-triggers' + (secret ? '?secret=' + encodeURIComponent(secret) : '')),
};

export const ownerAPI = {
  getTenant: () => api.get('/owner/tenant'),
  updateTenant: (data) => api.put('/owner/tenant', data),
  getCustomers: (params) => api.get('/owner/customers', { params }),
  getAnalytics: (params) => api.get('/owner/analytics', { params }),
  scanVisit: (data) => api.post('/owner/scan', data),
  scan: (data) => api.post('/owner/scan', data),
  register: (data) => api.post('/owner/register', data),
  getCardTemplate: () => api.get('/owner/card-template'),
  saveCardTemplate: (data) => api.post('/owner/card-template', data),
  getCampaigns: () => api.get('/owner/campaigns'),
  createCampaign: (data) => api.post('/owner/campaigns', data),
  sendCampaign: (id) => api.post('/owner/campaigns/' + id + '/send'),
  previewSegment: (data) => api.post('/owner/campaigns/preview-segment', data),
  aiQuery: (data) => api.post('/owner/ai-query', data),
  // New methods for dashboard
  getBranches: () => api.get('/owner/branches'),
  createBranch: (data) => api.post('/owner/branches', data),
  deleteBranch: (id) => api.delete('/owner/branches/' + id),
  getCardsFilled: (params) => api.get('/owner/analytics/cards-filled', { params }),
  getRecovered: (params) => api.get('/owner/analytics/recovered', { params }),
  getHighestPaying: (params) => api.get('/owner/analytics/highest-paying', { params }),
  getAcquisitionSources: (params) => api.get('/owner/analytics/acquisition-sources', { params }),
  getAnalyticsSummary: (params) => api.get('/owner/analytics/summary', { params }),
  getCustomerMap: (params) => api.post('/owner/customers/map', null, { params }),
  sendCampaignToGroup: (data) => api.post('/owner/campaigns/send-to-group', data),
  getCampaignTracking: (id) => api.get('/owner/campaigns/' + id + '/tracking'),
  // --- 12 new insight endpoints ---
  getChurn: () => api.get('/owner/analytics/churn'),
  getLTV: () => api.get('/owner/analytics/ltv'),
  getAlerts: () => api.get('/owner/analytics/alerts'),
  getTimeSegmentation: () => api.get('/owner/analytics/time-segmentation'),
  getCityBreakdown: () => api.get('/owner/analytics/city-breakdown'),
  getReactivationTemplates: () => api.get('/owner/campaigns/reactivation-templates'),
  updateSenderName: (name) => api.put('/owner/settings/sender-name', { sender_name: name }),
  listTeam: () => api.get('/owner/team'),
  addTeamMember: (data) => api.post('/owner/team', data),
  removeTeamMember: (email) => api.delete('/owner/team/' + encodeURIComponent(email)),
  getMonthlyReport: (month) => api.get('/owner/monthly-report' + (month ? '?month=' + month : '')),
  getActiveCards: () => api.get('/owner/analytics/active-cards'),
  trackOfferClick: (campaignId, customerId) =>
    api.post('/campaigns/' + campaignId + '/track-click' + (customerId ? '?customer_id=' + customerId : '')),
  trackPushDismiss: (campaignId) => api.post('/campaigns/' + campaignId + '/track-dismiss'),
  // -- Scheduled / triggered campaigns --
  scheduleCampaign: (data) => api.post('/owner/campaigns/schedule', data),
  listScheduled: () => api.get('/owner/campaigns/scheduled'),
  deleteScheduled: (id) => api.delete('/owner/campaigns/scheduled/' + id),
  // -- Upgrade plan request (owner side) --
  requestUpgrade: (data) => api.post('/owner/request-upgrade', data),
  // -- Modern card designer --
  savePromotion: (data, notify = false) =>
    api.post('/owner/card-template/promotion' + (notify ? '?notify=true' : ''), data),
  saveCardDetails: (data) => api.post('/owner/card-template/details', data),
  sendCardNotification: (data) => api.post('/owner/card-notifications', data),
};

export const publicAPI = {
  getJoinInfo: (slug) => api.get('/join/' + slug),
  joinProgram: (slug, data) => api.post('/join/' + slug, data),
};

export default api;
