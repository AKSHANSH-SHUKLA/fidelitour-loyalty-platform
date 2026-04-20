import React, { useState, useEffect } from 'react';
import { Send, Plus, Filter, Users, MessageSquare, Clock, CheckCircle2, AlertCircle, Megaphone, Eye, AlertTriangle, TrendingUp } from 'lucide-react';
import { ownerAPI } from '../lib/api';
import api from '../lib/api';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sendConfirmation, setSendConfirmation] = useState(null);
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedCampaignTab, setSelectedCampaignTab] = useState('by-filter'); // 'by-filter' or 'by-customers'
  const [campaignCustomers, setCampaignCustomers] = useState('');
  const [viewingTrackingId, setViewingTrackingId] = useState(null);
  const [trackingData, setTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    campaignName: '',
    message: '',
    filters: {
      tiers: [],
      hasWalletPass: 'any',
      minPoints: 0,
      minVisits: 0,
      postalCodes: '',
      minAmountPaid: 0,
    },
  });

  // Load campaigns on mount
  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await ownerAPI.getCampaigns();
      setCampaigns(response.data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFilterChange = (filterName, value) => {
    setFormData((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        [filterName]: value,
      },
    }));
  };

  const handleTierChange = (tier) => {
    setFormData((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        tiers: prev.filters.tiers.includes(tier)
          ? prev.filters.tiers.filter((t) => t !== tier)
          : [...prev.filters.tiers, tier],
      },
    }));
  };

  const buildFilterPayload = () => {
    return {
      tiers: formData.filters.tiers.length > 0 ? formData.filters.tiers : undefined,
      hasWalletPass: formData.filters.hasWalletPass !== 'any' ? formData.filters.hasWalletPass === 'yes' : undefined,
      minPoints: formData.filters.minPoints > 0 ? formData.filters.minPoints : undefined,
      minVisits: formData.filters.minVisits > 0 ? formData.filters.minVisits : undefined,
      postalCodes: formData.filters.postalCodes ? formData.filters.postalCodes.split(',').map((code) => code.trim()) : undefined,
      minAmountPaid: formData.filters.minAmountPaid > 0 ? formData.filters.minAmountPaid : undefined,
    };
  };

  const previewSegment = async () => {
    try {
      setPreviewLoading(true);
      const filters = buildFilterPayload();
      const response = await api.post('/owner/campaigns/preview-segment', { filters });
      setPreviewCount(response.data.count || 0);
    } catch (error) {
      console.error('Error previewing segment:', error);
      setPreviewCount(0);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!formData.campaignName.trim() || !formData.message.trim()) {
      alert('Please fill in campaign name and message');
      return;
    }

    try {
      if (selectedCampaignTab === 'by-filter') {
        // Original filter-based flow
        const payload = {
          name: formData.campaignName,
          message: formData.message,
          filters: buildFilterPayload(),
        };
        await api.post('/owner/campaigns', payload);
      } else {
        // Send directly to selected customers
        const customerList = campaignCustomers
          .split('\n')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        if (customerList.length === 0) {
          alert('Please enter at least one customer');
          return;
        }

        // Parse customer names or emails and send
        await ownerAPI.sendCampaignToGroup({
          customer_names: customerList,
          message: formData.message,
        });
      }

      resetForm();
      setCampaignCustomers('');
      setSelectedCampaignTab('by-filter');
      setShowCreateModal(false);
      await fetchCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign');
    }
  };

  const fetchCampaignTracking = async (campaignId) => {
    try {
      setTrackingLoading(true);
      const res = await ownerAPI.getCampaignTracking(campaignId);
      setTrackingData(res.data);
    } catch (error) {
      console.error('Error fetching tracking:', error);
      alert('Failed to load campaign details');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleSendCampaign = (campaign) => {
    setSendConfirmation(campaign);
  };

  const confirmSendCampaign = async () => {
    try {
      await api.post(`/owner/campaigns/${sendConfirmation.id}/send`);
      setSendConfirmation(null);
      await fetchCampaigns();
    } catch (error) {
      console.error('Error sending campaign:', error);
      alert('Failed to send campaign');
    }
  };

  const resetForm = () => {
    setFormData({
      campaignName: '',
      message: '',
      filters: {
        tiers: [],
        hasWalletPass: 'any',
        minPoints: 0,
        minVisits: 0,
        postalCodes: '',
        minAmountPaid: 0,
      },
    });
    setPreviewCount(null);
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      draft: 'bg-gray-200 text-gray-800',
      sent: 'bg-green-200 text-green-800',
      scheduled: 'bg-blue-200 text-blue-800',
    };
    return (
      <span className={`px-2 py-1 text-sm font-medium rounded ${statusStyles[status] || 'bg-gray-200 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getFilterBadges = (campaign) => {
    const badges = [];
    if (campaign.filters?.tiers?.length > 0) {
      campaign.filters.tiers.forEach((tier) => {
        badges.push(`${tier[0].toUpperCase() + tier.slice(1)} Tier`);
      });
    }
    if (campaign.filters?.hasWalletPass) {
      badges.push('Has Wallet Pass');
    }
    if (campaign.filters?.minPoints > 0) {
      badges.push(`Min ${campaign.filters.minPoints} Points`);
    }
    if (campaign.filters?.minVisits > 0) {
      badges.push(`Min ${campaign.filters.minVisits} Visits`);
    }
    if (campaign.filters?.minAmountPaid > 0) {
      badges.push(`Min €${campaign.filters.minAmountPaid}`);
    }
    return badges;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FDFBF7' }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: '#E7E5E4', backgroundColor: '#F3EFE7' }}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                Campaigns
              </h1>
              <p style={{ color: '#57534E', fontFamily: 'Manrope' }}>Create and manage loyalty campaigns for your customers</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-lg font-semibold text-white transition"
              style={{ backgroundColor: '#B85C38' }}
            >
              <Plus size={20} />
              New Campaign
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Unread Campaign Warnings */}
        {!loading && campaigns.length > 0 && (() => {
          const lowOpenRateCampaigns = campaigns.filter(
            c => c.status === 'sent' &&
            c.delivered_count > 0 &&
            ((c.opens_unique || 0) / (c.delivered_count || 1)) * 100 < 15
          );
          return lowOpenRateCampaigns.length > 0 ? (
            <div className="mb-6 p-4 rounded-lg border-l-4 bg-amber-50" style={{ borderColor: '#E3A869' }}>
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} style={{ color: '#E3A869' }} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#1C1917]">Tip: Campaigns with catchy subject lines get 2-3x more opens.</p>
                  <p className="text-sm text-[#57534E]">Try making your next subject more personal.</p>
                </div>
              </div>
            </div>
          ) : null;
        })()}

        {loading ? (
          <div className="text-center py-12">
            <p style={{ color: '#57534E', fontFamily: 'Manrope' }}>Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone size={48} style={{ color: '#B85C38', margin: '0 auto 16px' }} />
            <p style={{ color: '#57534E', fontFamily: 'Manrope' }} className="text-lg">
              No campaigns yet. Create your first campaign to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const filterBadges = getFilterBadges(campaign);
              return (
                <div
                  key={campaign.id}
                  className="border rounded-lg p-6 transition hover:shadow-md"
                  style={{ borderColor: '#E7E5E4', backgroundColor: '#FDFBF7' }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                        {campaign.name}
                      </h3>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(campaign.status)}
                        <div style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '14px' }} className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Users size={16} />
                            {campaign.targeted_count || campaign.targetedCount || 0} targeted
                          </span>
                          {campaign.status === 'sent' && (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 size={16} />
                              {campaign.delivered_count || campaign.deliveredCount || 0} delivered
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={16} />
                            {new Date(campaign.created_at || campaign.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    {campaign.status === 'draft' && (
                      <button
                        onClick={() => handleSendCampaign(campaign)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition ml-4"
                        style={{ backgroundColor: '#B85C38' }}
                      >
                        <Send size={18} />
                        Send
                      </button>
                    )}
                  </div>

                  {/* Tracking Stats */}
                  {campaign.status === 'sent' && (
                    <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded bg-[#F3EFE7]">
                        <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Sent to</p>
                        <p className="text-lg font-bold text-[#1C1917]">{campaign.targeted_count || 0}</p>
                      </div>
                      <div className="p-3 rounded bg-[#F3EFE7]">
                        <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Delivered</p>
                        <p className="text-lg font-bold text-[#1C1917]">{campaign.delivered_count || 0}</p>
                      </div>
                      <div className="p-3 rounded bg-[#F3EFE7]">
                        <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Opened</p>
                        <p className="text-lg font-bold text-[#1C1917]">
                          {campaign.delivered_count > 0
                            ? Math.round(((campaign.opens_unique || 0) / campaign.delivered_count) * 100)
                            : 0}%
                        </p>
                      </div>
                      <div className="p-3 rounded bg-[#F3EFE7]">
                        <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Visits after</p>
                        <p className="text-lg font-bold text-[#1C1917]">
                          {campaign.delivered_count > 0
                            ? Math.round(((campaign.visits_from_campaign || 0) / campaign.delivered_count) * 100)
                            : 0}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Message preview */}
                  <div className="mb-4 p-4 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                    <p style={{ color: '#57534E', fontFamily: 'Manrope' }} className="text-sm">
                      {campaign.message}
                    </p>
                  </div>

                  {/* Filter badges */}
                  {filterBadges.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {filterBadges.map((badge, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 text-sm rounded-full"
                          style={{ backgroundColor: '#E3A869', color: '#FDFBF7', fontFamily: 'Manrope' }}
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* View Details Button */}
                  {campaign.status === 'sent' && (
                    <button
                      onClick={() => {
                        setViewingTrackingId(campaign.id);
                        fetchCampaignTracking(campaign.id);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded text-sm font-semibold text-[#B85C38] hover:bg-[#F3EFE7] transition"
                    >
                      <Eye size={16} />
                      View details
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto" style={{ backgroundColor: '#FDFBF7' }}>
            <div className="border-b p-6" style={{ borderColor: '#E7E5E4' }}>
              <h2 className="text-3xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                Create New Campaign
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Audience Tab Selector */}
              <div className="flex gap-4 border-b" style={{ borderColor: '#E7E5E4' }}>
                <button
                  onClick={() => setSelectedCampaignTab('by-filter')}
                  className={`pb-3 px-3 font-semibold text-sm border-b-2 transition ${
                    selectedCampaignTab === 'by-filter'
                      ? 'border-[#B85C38] text-[#B85C38]'
                      : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  By filter
                </button>
                <button
                  onClick={() => setSelectedCampaignTab('by-customers')}
                  className={`pb-3 px-3 font-semibold text-sm border-b-2 transition ${
                    selectedCampaignTab === 'by-customers'
                      ? 'border-[#B85C38] text-[#B85C38]'
                      : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  By selected customers
                </button>
              </div>

              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                  Campaign Name
                </label>
                <input
                  type="text"
                  name="campaignName"
                  value={formData.campaignName}
                  onChange={handleInputChange}
                  placeholder="e.g. Summer Promo"
                  className="w-full px-4 py-2 border rounded-lg"
                  style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                  Message
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Your campaign message..."
                  rows={4}
                  className="w-full px-4 py-2 border rounded-lg"
                  style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                />
              </div>

              {/* By Customers Mode */}
              {selectedCampaignTab === 'by-customers' && (
                <div className="p-4 rounded border-2" style={{ borderColor: '#E3A869', backgroundColor: '#F3EFE7' }}>
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Customer Names or Emails (one per line)
                  </label>
                  <textarea
                    value={campaignCustomers}
                    onChange={(e) => setCampaignCustomers(e.target.value)}
                    placeholder="Marie Dubois&#10;john@example.com&#10;..."
                    rows={4}
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                  />
                  <p className="text-xs text-[#57534E] mt-2" style={{ fontFamily: 'Manrope' }}>
                    Enter customer names or email addresses, one per line
                  </p>
                </div>
              )}

              {/* Audience Filters (only in by-filter mode) */}
              {selectedCampaignTab === 'by-filter' && (
              <div className="border-t pt-6" style={{ borderColor: '#E7E5E4' }}>
                <h3 className="text-xl font-bold mb-4" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                  Audience Filters
                </h3>

                {/* Tier */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-3" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Tier
                  </label>
                  <div className="space-y-2">
                    {['bronze', 'silver', 'gold'].map((tier) => (
                      <label key={tier} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.filters.tiers.includes(tier)}
                          onChange={() => handleTierChange(tier)}
                          className="w-4 h-4"
                        />
                        <span style={{ color: '#57534E', fontFamily: 'Manrope' }}>
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Has Wallet Pass */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Has Wallet Pass
                  </label>
                  <select
                    value={formData.filters.hasWalletPass}
                    onChange={(e) => handleFilterChange('hasWalletPass', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                  >
                    <option value="any">Any</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                {/* Min Points */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Minimum Points
                  </label>
                  <input
                    type="number"
                    value={formData.filters.minPoints}
                    onChange={(e) => handleFilterChange('minPoints', parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                  />
                </div>

                {/* Min Visits */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Minimum Visits
                  </label>
                  <input
                    type="number"
                    value={formData.filters.minVisits}
                    onChange={(e) => handleFilterChange('minVisits', parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                  />
                </div>

                {/* Postal Codes */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Postal Code Region
                  </label>
                  <input
                    type="text"
                    value={formData.filters.postalCodes}
                    onChange={(e) => handleFilterChange('postalCodes', e.target.value)}
                    placeholder="e.g. 75001 or 75001,75002,75003"
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                  />
                  <p style={{ color: '#57534E', fontFamily: 'Manrope', fontSize: '12px' }} className="mt-1">
                    Enter one or more postal codes separated by commas to target a region
                  </p>
                </div>

                {/* Min Amount Paid */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold mb-2" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    Minimum Amount Paid (€)
                  </label>
                  <input
                    type="number"
                    value={formData.filters.minAmountPaid}
                    onChange={(e) => handleFilterChange('minAmountPaid', parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.01}
                    className="w-full px-4 py-2 border rounded-lg"
                    style={{ borderColor: '#E7E5E4', color: '#1C1917' }}
                  />
                </div>

                {/* Preview Segment */}
                <button
                  onClick={previewSegment}
                  disabled={previewLoading}
                  className="w-full px-4 py-2 border rounded-lg font-semibold transition flex items-center justify-center gap-2"
                  style={{ borderColor: '#B85C38', color: '#B85C38' }}
                >
                  <Filter size={18} />
                  {previewLoading ? 'Previewing...' : 'Preview Segment'}
                </button>

                {previewCount !== null && (
                  <div className="mt-3 p-4 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                    <p style={{ color: '#57534E', fontFamily: 'Manrope' }} className="font-semibold">
                      This campaign will reach <span style={{ color: '#B85C38' }}>{previewCount}</span> customers
                    </p>
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t p-6 flex justify-end gap-3" style={{ borderColor: '#E7E5E4' }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-6 py-2 rounded-lg font-semibold border transition"
                style={{ borderColor: '#E7E5E4', color: '#57534E' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                className="px-6 py-2 rounded-lg font-semibold text-white transition"
                style={{ backgroundColor: '#B85C38' }}
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Confirmation Modal */}
      {sendConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full" style={{ backgroundColor: '#FDFBF7' }}>
            <div className="border-b p-6" style={{ borderColor: '#E7E5E4' }}>
              <h2 className="text-3xl font-bold flex items-center gap-3" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                <AlertCircle size={32} style={{ color: '#B85C38' }} />
                Send Campaign
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#57534E', fontFamily: 'Manrope' }}>
                  Campaign Name
                </p>
                <p className="text-lg" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                  {sendConfirmation.name}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#57534E', fontFamily: 'Manrope' }}>
                  Message
                </p>
                <div className="p-4 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                  <p style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                    {sendConfirmation.message}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded border" style={{ borderColor: '#E3A869', backgroundColor: '#F3EFE7' }}>
                <p className="font-semibold" style={{ color: '#1C1917', fontFamily: 'Manrope' }}>
                  This will be sent to <span style={{ color: '#B85C38' }}>{sendConfirmation.targeted_count || sendConfirmation.targetedCount || 0}</span> customers
                </p>
              </div>
            </div>

            <div className="border-t p-6 flex justify-end gap-3" style={{ borderColor: '#E7E5E4' }}>
              <button
                onClick={() => setSendConfirmation(null)}
                className="px-6 py-2 rounded-lg font-semibold border transition"
                style={{ borderColor: '#E7E5E4', color: '#57534E' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSendCampaign}
                className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-white transition"
                style={{ backgroundColor: '#B85C38' }}
              >
                <Send size={18} />
                Confirm Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Details Drawer */}
      {viewingTrackingId && trackingData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto" style={{ backgroundColor: '#FDFBF7' }}>
            <div className="border-b p-6" style={{ borderColor: '#E7E5E4' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                  Campaign Tracking
                </h2>
                <button
                  onClick={() => {
                    setViewingTrackingId(null);
                    setTrackingData(null);
                  }}
                  className="text-[#8B8680] hover:text-[#1C1917] text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Tracking Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                  <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Sent to</p>
                  <p className="text-2xl font-bold text-[#1C1917]">{trackingData.targeted_count || 0}</p>
                </div>
                <div className="p-3 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                  <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Delivered</p>
                  <p className="text-2xl font-bold text-[#1C1917]">{trackingData.delivered_count || 0}</p>
                </div>
                <div className="p-3 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                  <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Opened</p>
                  <p className="text-2xl font-bold text-[#1C1917]">
                    {trackingData.delivered_count > 0
                      ? Math.round(((trackingData.opens_unique || 0) / trackingData.delivered_count) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="p-3 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                  <p className="text-xs text-[#8B8680]" style={{ fontFamily: 'Manrope' }}>Visited within 7d</p>
                  <p className="text-2xl font-bold text-[#1C1917]">
                    {trackingData.delivered_count > 0
                      ? Math.round(((trackingData.visits_from_campaign || 0) / trackingData.delivered_count) * 100)
                      : 0}%
                  </p>
                </div>
              </div>

              {/* Recipients List */}
              <div>
                <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Cormorant Garamond', color: '#1C1917' }}>
                  Recipients
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(trackingData.recipients || []).map((recipient, idx) => (
                    <div key={idx} className="p-3 rounded flex items-center justify-between" style={{ backgroundColor: '#F3EFE7' }}>
                      <div>
                        <p className="font-semibold text-[#1C1917]">{recipient.customer_name || 'Unknown'}</p>
                        <p className="text-xs text-[#8B8680]">{recipient.email}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-sm">
                          {recipient.opened ? <CheckCircle2 size={16} style={{ color: '#4A5D23' }} /> : <AlertCircle size={16} style={{ color: '#8B8680' }} />}
                          <span style={{ color: recipient.opened ? '#4A5D23' : '#8B8680' }}>{recipient.opened ? 'Opened' : 'Not opened'}</span>
                        </span>
                        <span className="flex items-center gap-1 text-sm">
                          {recipient.visited ? <CheckCircle2 size={16} style={{ color: '#4A5D23' }} /> : <AlertCircle size={16} style={{ color: '#8B8680' }} />}
                          <span style={{ color: recipient.visited ? '#4A5D23' : '#8B8680' }}>{recipient.visited ? 'Visited' : 'No visit'}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Toolbar */}
              <div className="pt-4 border-t flex gap-3" style={{ borderColor: '#E7E5E4' }}>
                <button
                  className="flex-1 px-4 py-2 rounded-lg border font-semibold transition"
                  style={{ borderColor: '#B85C38', color: '#B85C38' }}
                  onClick={() => alert('Follow-up to non-openers feature would be implemented here')}
                >
                  Follow-up to non-openers
                </button>
                <button
                  className="flex-1 px-4 py-2 rounded-lg border font-semibold transition"
                  style={{ borderColor: '#B85C38', color: '#B85C38' }}
                  onClick={() => alert('Follow-up to non-visitors feature would be implemented here')}
                >
                  Follow-up to non-visitors
                </button>
              </div>
            </div>

            <div className="border-t p-6" style={{ borderColor: '#E7E5E4' }}>
              <button
                onClick={() => {
                  setViewingTrackingId(null);
                  setTrackingData(null);
                }}
                className="w-full px-6 py-2 rounded-lg font-semibold text-white transition"
                style={{ backgroundColor: '#B85C38' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
