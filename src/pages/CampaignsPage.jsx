import React, { useState, useEffect } from 'react';
import { Send, Plus, Filter, Users, MessageSquare, Clock, CheckCircle2, AlertCircle, Megaphone } from 'lucide-react';
import { ownerAPI } from '../lib/api';
import api from '../lib/api';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sendConfirmation, setSendConfirmation] = useState(null);
  const [previewCount, setPreviewCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
      const payload = {
        name: formData.campaignName,
        message: formData.message,
        filters: buildFilterPayload(),
      };
      await api.post('/owner/campaigns', payload);
      resetForm();
      setShowCreateModal(false);
      await fetchCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign');
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

                  {/* Message preview */}
                  <div className="mb-4 p-4 rounded" style={{ backgroundColor: '#F3EFE7' }}>
                    <p style={{ color: '#57534E', fontFamily: 'Manrope' }} className="text-sm">
                      {campaign.message}
                    </p>
                  </div>

                  {/* Filter badges */}
                  {filterBadges.length > 0 && (
                    <div className="flex flex-wrap gap-2">
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

              {/* Audience Filters */}
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
    </div>
  );
}
