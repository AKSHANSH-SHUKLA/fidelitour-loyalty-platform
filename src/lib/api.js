import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Belt-and-braces auth: even though the backend sets an httpOnly cookie on
// login, some browsers / extensions / cross-tab edge cases drop the cookie on
// POST requests. We ALSO stash the JWT in localStorage and attach it as a
// Bearer header on every request. The backend now accepts either path.
const TOKEN_KEY = 'fidelitour_access_token';

export const setAuthToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (_e) { /* private mode etc — silent */ }
};

api.interceptors.request.use((config) => {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${t}`;
    }
  } catch (_e) { /* ignore */ }
  return config;
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
  // -- Reviews (super admin: global or per-tenant) --
  getReviewAnalytics: (params) => api.get('/admin/analytics/reviews', { params }),
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
  updateCampaign: (id, data) => api.put('/owner/campaigns/' + id, data),
  sendCampaign: (id) => api.post('/owner/campaigns/' + id + '/send'),
  previewSegment: (data) => api.post('/owner/campaigns/preview-segment', data),
  aiQuery: (data) => api.post('/owner/ai-query', data),
  // New methods for dashboard
  getBranches: () => api.get('/owner/branches'),
  createBranch: (data) => api.post('/owner/branches', data),
  deleteBranch: (id) => api.delete('/owner/branches/' + id),
  getBranchPerformance: (params) => api.get('/owner/branches/performance', { params }),
  getLtvBreakdown: (params) => api.get('/owner/analytics/ltv-breakdown', { params }),
  getProactiveAlerts: (params) => api.get('/owner/insights/alerts', { params }),
  getAiSuggestions: (params) => api.get('/owner/ai/suggestions', { params }),
  getCardsFilled: (params) => api.get('/owner/analytics/cards-filled', { params }),
  getRecovered: (params) => api.get('/owner/analytics/recovered', { params }),
  getHighestPaying: (params) => api.get('/owner/analytics/highest-paying', { params }),
  getAcquisitionSources: (params) => api.get('/owner/analytics/acquisition-sources', { params }),
  getAnalyticsSummary: (params) => api.get('/owner/analytics/summary', { params }),
  // Single-metric endpoint — drives per-tile period pickers on dashboard/analytics.
  // params: { metric, days, branch_id? }
  getAnalyticsMetric: (params) => api.get('/owner/analytics/metric', { params }),
  // Customer cleanup (item 31) — soft-delete + restore + trash view
  purgeInactiveCustomers: (data) => api.post('/owner/customers/purge-inactive', data),
  restoreCustomer: (customerId) => api.post(`/owner/customers/${customerId}/restore`),
  getCustomerTrash: () => api.get('/owner/customers/trash'),
  // AI campaign analyzer (item 23) — returns 3 plain-English bullets
  aiAnalyzeCampaign: (campaignId) => api.post(`/owner/campaigns/${campaignId}/ai-analyze`),
  // Tenant identity — works for owner, manager, staff. Used by the sidebar
  // tenant badge so the user always knows which account they're in.
  getTenant: () => api.get('/owner/tenant'),
  // Team password reset — returns the new plaintext password ONCE so the owner can share it.
  resetTeamPassword: (email, newPassword) =>
    api.post(`/owner/team/${encodeURIComponent(email)}/reset-password`, {
      new_password: newPassword || null,
    }),
  getCustomerMap: (params) => api.post('/owner/customers/map', null, { params }),
  sendCampaignToGroup: (data) => api.post('/owner/campaigns/send-to-group', data),
  getCampaignTracking: (id) => api.get('/owner/campaigns/' + id + '/tracking'),
  // --- 12 new insight endpoints (now accept params, used to forward branch_id) ---
  getChurn: (params) => api.get('/owner/analytics/churn', { params }),
  getLTV: (params) => api.get('/owner/analytics/ltv', { params }),
  getAlerts: (params) => api.get('/owner/analytics/alerts', { params }),
  getTimeSegmentation: (params) => api.get('/owner/analytics/time-segmentation', { params }),
  getCityBreakdown: (params) => api.get('/owner/analytics/city-breakdown', { params }),
  getReactivationTemplates: (params) => api.get('/owner/campaigns/reactivation-templates', { params }),
  updateSenderName: (name) => api.put('/owner/settings/sender-name', { sender_name: name }),
  listTeam: () => api.get('/owner/team'),
  addTeamMember: (data) => api.post('/owner/team', data),
  removeTeamMember: (email) => api.delete('/owner/team/' + encodeURIComponent(email)),
  getMonthlyReport: (month) => api.get('/owner/monthly-report' + (month ? '?month=' + month : '')),
  getActiveCards: (params) => api.get('/owner/analytics/active-cards', { params }),
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
  // -- Reward redemption (this batch) --
  redeemReward: (data) => api.post('/owner/rewards/redeem', data),
  listRedeemedRewards: (params) => api.get('/owner/rewards/redeemed', { params }),
  // -- Per-customer visit history --
  customerVisitHistory: (customerId, params) =>
    api.get('/owner/customers/' + customerId + '/visits', { params }),
  // -- Birthdays this month --
  birthdaysThisMonth: (params) =>
    api.get('/owner/analytics/birthdays-this-month', { params }),
  // -- Saved segments --
  listSavedSegments: () => api.get('/owner/segments'),
  createSavedSegment: (data) => api.post('/owner/segments', data),
  deleteSavedSegment: (id) => api.delete('/owner/segments/' + id),
  // -- Reviews & ratings --
  getReviewAnalytics: (params) => api.get('/owner/analytics/reviews', { params }),
  listReviews: (params) => api.get('/owner/reviews', { params }),
};

export const publicAPI = {
  getJoinInfo: (slug) => api.get('/join/' + slug),
  joinProgram: (slug, data) => api.post('/join/' + slug, data),
  // -- Real-time proximity push (wallet card calls this with device GPS) --
  proximityPing: (data) => api.post('/public/proximity-ping', data),
  // -- Customer review submission (wallet card → rate-your-visit panel) --
  submitReview: (data) => api.post('/public/reviews', data),
};

export default api;
